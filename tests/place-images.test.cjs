const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

const OLD_URL = 'https://maps.googleapis.com/maps/api/place/js/PhotoService.GetPhoto?token=expired';
const NEW_URL = 'https://maps.googleapis.com/maps/api/place/js/PhotoService.GetPhoto?token=fresh';

function setup(overrides = {}, options = {}) {
    const item = {
        id: 'item-1', title: '도쿄타워', category: 'place', address: 'Tokyo',
        imageUrl: OLD_URL, placeId: 'place-1', comments: [], isFavorite: true,
        ...overrides
    };
    const data = {
        currentTripId: 'trip-1', settings: {},
        trips: [{ id: 'trip-1', days: [{ id: 'day-1', dayNumber: 1, items: [item] }], candidates: [] }]
    };
    const stored = new Map([['travelmate_data', JSON.stringify(data)]]);
    const elements = new Map();
    const images = [];
    const calls = [];
    const timers = new Map();
    const writes = [];
    let timerId = 0;
    const document = {
        getElementById: id => elements.get(id) || null,
        querySelector: () => null,
        querySelectorAll: () => images,
        createElement: () => ({
            style: {},
            set textContent(value) {
                this.innerHTML = String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;')
                    .replaceAll('>', '&gt;').replaceAll('"', '&quot;');
            }
        }),
        body: { appendChild: el => elements.set(el.id, el) }
    };
    class PlacesService {
        getDetails(request, callback) { calls.push({ method: 'details', request, callback }); }
        textSearch(request, callback) { calls.push({ method: 'search', request, callback }); }
    }
    const context = vm.createContext({
        console, URL, document,
        setTimeout: callback => { timers.set(++timerId, callback); return timerId; },
        clearTimeout: id => timers.delete(id),
        localStorage: {
            getItem: key => stored.get(key) || null,
            setItem: (key, value) => stored.set(key, value)
        },
        FirebaseSync: { isConnected: () => true, pushData: value => writes.push(JSON.stringify(value)) },
        google: options.noGoogle ? undefined : { maps: { places: { PlacesService } } },
        Image: class {
            set src(value) {
                this.url = value;
                queueMicrotask(() => options.badPhoto ? this.onerror() : this.onload());
            }
        }
    });
    for (const file of ['js/store.js', 'js/components.js', 'js/features.js']) {
        vm.runInContext(readFileSync(resolve(__dirname, '..', file), 'utf8'), context, { filename: file });
    }
    const { Store, UI, Itinerary, Favorites } = vm.runInContext('({ Store, UI, Itinerary, Favorites })', context);
    function image(itemId = 'item-1', url = OLD_URL, tripId = 'trip-1') {
        const img = {
            dataset: { tripId, itemId }, style: {}, src: url,
            getAttribute(name) { return name === 'src' ? this.src : null; }
        };
        images.push(img);
        return img;
    }
    function reply(index = 0, { status = 'OK', url = NEW_URL, noPhotos = false, placeId = 'place-1' } = {}) {
        const place = { place_id: placeId, photos: noPhotos ? [] : [{ getUrl: () => url }] };
        const call = calls[index];
        call.callback(call.method === 'search' ? [place] : place, status);
    }
    function currentItem() { return Store.getTrips()[0].days.flatMap(day => day.items).find(i => i.id === 'item-1'); }
    return { Store, UI, Itinerary, Favorites, context, stored, elements, calls, timers, writes, image, reply, currentItem };
}

test('expired Google photo is renewed and saved locally and to Firebase', async () => {
    const h = setup();
    const img = h.image();
    const pending = h.UI.refreshPlaceImage(img);
    assert.equal(img.style.display, 'none');
    assert.equal(h.calls[0].request.placeId, 'place-1');
    assert.deepEqual(Array.from(h.calls[0].request.fields), ['place_id', 'photos']);
    h.reply();
    await pending;
    assert.equal(img.src, NEW_URL);
    assert.equal(img.style.display, '');
    assert.equal(h.currentItem().imageUrl, NEW_URL);
    assert.equal(JSON.parse(h.stored.get('travelmate_data')).trips[0].days[0].items[0].imageUrl, NEW_URL);
    assert.equal(JSON.parse(h.writes[0]).trips[0].days[0].items[0].imageUrl, NEW_URL);
    assert.equal(h.timers.size, 0);
});

test('itinerary and favorites share one request and both show the restored image', async () => {
    const h = setup();
    const itinerary = h.image();
    const favorite = h.image();
    const pending = [h.UI.refreshPlaceImage(itinerary), h.UI.refreshPlaceImage(favorite)];
    assert.equal(h.calls.length, 1);
    h.reply();
    await Promise.all(pending);
    assert.equal(itinerary.src, NEW_URL);
    assert.equal(favorite.src, NEW_URL);
    assert.equal(h.writes.length, 1);
});

test('legacy photo without place ID is found by title and address', async () => {
    const h = setup({ placeId: null });
    const img = h.image();
    const pending = h.UI.refreshPlaceImage(img);
    assert.equal(h.calls[0].method, 'search');
    assert.equal(h.calls[0].request.query, '도쿄타워 Tokyo');
    h.reply();
    await pending;
    assert.equal(img.src, NEW_URL);
    assert.equal(h.currentItem().placeId, 'place-1');
});

for (const failure of ['API error', 'no photos', 'photo load error', 'timeout']) {
    test(`${failure} retains saved image and throttles further requests`, async () => {
        const h = setup({}, { badPhoto: failure === 'photo load error' });
        const img = h.image();
        const pending = h.UI.refreshPlaceImage(img);
        if (failure === 'timeout') Array.from(h.timers.values())[0]();
        else h.reply(0, { status: failure === 'API error' ? 'OVER_QUERY_LIMIT' : 'OK', noPhotos: failure === 'no photos' });
        await pending;
        assert.equal(h.currentItem().imageUrl, OLD_URL);
        assert.equal(h.writes.length, 0);
        assert.equal(img.style.display, 'none');
        await h.UI.refreshPlaceImage(img);
        await h.UI.refreshPlaceImage(h.image());
        assert.equal(h.calls.length, 1);
    });
}

test('a second load error cannot trigger an infinite retry', async () => {
    const h = setup();
    const img = h.image();
    const pending = h.UI.refreshPlaceImage(img);
    h.reply();
    await pending;
    await h.UI.refreshPlaceImage(img);
    assert.equal(h.calls.length, 1);
    assert.equal(img.style.display, 'none');
    assert.equal(h.currentItem().imageUrl, NEW_URL);
});

test('user image changes during a request are preserved', async () => {
    const h = setup();
    const img = h.image();
    const pending = h.UI.refreshPlaceImage(img);
    h.Store.updateItineraryItem('trip-1', 'day-1', 'item-1', { imageUrl: 'https://example.com/custom.jpg' });
    h.reply();
    await pending;
    assert.equal(h.currentItem().imageUrl, 'https://example.com/custom.jpg');
    assert.equal(img.src, OLD_URL);
    assert.equal(h.writes.length, 1);
});

test('moving an item during renewal saves the photo to its current day', async () => {
    const h = setup();
    const img = h.image();
    const pending = h.UI.refreshPlaceImage(img);
    const trip = h.Store.getTrips()[0];
    trip.days.push({ id: 'day-2', dayNumber: 2, items: [] });
    h.Store.moveItineraryItem('trip-1', 'day-1', 'day-2', 'item-1', 0);
    h.reply();
    await pending;
    assert.equal(trip.days[0].items.length, 0);
    assert.equal(trip.days[1].items[0].imageUrl, NEW_URL);
    assert.equal(img.src, NEW_URL);
});

test('deleted items are not resurrected by a photo response', async () => {
    const h = setup();
    const pending = h.UI.refreshPlaceImage(h.image());
    h.Store.removeItineraryItem('trip-1', 'day-1', 'item-1');
    h.reply();
    await pending;
    assert.equal(h.currentItem(), undefined);
    assert.equal(h.writes.length, 1);
});

test('renewal remains tied to the original trip when the current trip changes', async () => {
    const h = setup();
    const img = h.image();
    const pending = h.UI.refreshPlaceImage(img);
    h.Store.getData().currentTripId = 'another-trip';
    h.reply();
    await pending;
    assert.equal(h.currentItem().imageUrl, NEW_URL);
    assert.equal(h.Store.getData().currentTripId, 'another-trip');
});

test('custom image failures never request or replace a Google photo', async () => {
    const url = 'https://example.com/custom.jpg';
    const h = setup({ imageUrl: url });
    const img = h.image('item-1', url);
    await h.UI.refreshPlaceImage(img);
    assert.equal(h.calls.length, 0);
    assert.equal(h.currentItem().imageUrl, url);
});

test('unavailable Google SDK retains saved data', async () => {
    const h = setup({}, { noGoogle: true });
    await h.UI.refreshPlaceImage(h.image());
    assert.equal(h.calls.length, 0);
    assert.equal(h.currentItem().imageUrl, OLD_URL);
});

test('actual itinerary and favorite rendering both use the recovery handler', () => {
    const h = setup();
    const itinerary = { innerHTML: '', addEventListener() {} };
    const favorite = { innerHTML: '' };
    h.elements.set('itinerary-content', itinerary);
    h.elements.set('favorites-content', favorite);
    h.Itinerary.render();
    h.Favorites.render();
    for (const container of [itinerary, favorite]) {
        assert.match(container.innerHTML, /onerror="UI\.refreshPlaceImage\(this\)"/);
        assert.match(container.innerHTML, /data-trip-id="trip-1" data-item-id="item-1"/);
        assert.match(container.innerHTML, /item-image-placeholder/);
    }
    assert.equal(h.calls.length, 0); // Valid images do not incur a Places request.
});
