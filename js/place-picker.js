/* ===================================
   트래블메이트 - 공용 장소 추가 팝업
   "장소 추가"(일정) 와 "일정 후보 추가"(후보) 를 하나의 팝업으로 통일한다.
   두 모드는 상단 제목과 일차/시간/비용 입력란 유무만 다르다.
   =================================== */

const PlacePicker = (() => {

    const PLACE_FIELDS = ['place_id', 'name', 'formatted_address', 'geometry', 'types', 'rating', 'photos'];

    let _results = [];      // 현재 검색 결과 목록
    let _meta = null;       // 검색/링크로 확정된 장소 메타데이터 (좌표·placeId·사진 등)
    let _ctx = null;        // 열려 있는 팝업의 컨텍스트
    let _modalAcs = [];     // 팝업에 붙인 Autocomplete (다음에 열 때 정리)

    // ---------- Google Places 공용 헬퍼 ----------
    function hasPlaces() {
        return typeof google !== 'undefined' && google.maps && google.maps.places;
    }

    // 지도가 아직 없어도 검색만은 가능하도록 숨김 컨테이너를 쓴다
    function placesService() {
        if (!hasPlaces()) return null;
        let host = document.getElementById('_place-picker-svc');
        if (!host) {
            host = document.createElement('div');
            host.id = '_place-picker-svc';
            host.style.display = 'none';
            document.body.appendChild(host);
        }
        try {
            return new google.maps.places.PlacesService(host);
        } catch (e) {
            return null;
        }
    }

    function categoryFromTypes(types) {
        const t = types || [];
        if (t.some(x => ['restaurant', 'food', 'cafe', 'bakery', 'bar', 'meal_delivery', 'meal_takeaway'].includes(x))) return 'food';
        if (t.some(x => ['lodging', 'hotel'].includes(x))) return 'accommodation';
        if (t.some(x => ['shopping_mall', 'store', 'clothing_store', 'shoe_store', 'jewelry_store'].includes(x))) return 'shopping';
        if (t.some(x => ['tourist_attraction', 'museum', 'amusement_park', 'aquarium', 'zoo', 'art_gallery', 'stadium', 'park'].includes(x))) return 'activity';
        return 'place';
    }

    function photoUrl(place, size) {
        if (!place || !place.photos || !place.photos.length) return '';
        try { return place.photos[0].getUrl({ maxWidth: size }); } catch (e) { return ''; }
    }

    function latLngOf(place) {
        const loc = place && place.geometry && place.geometry.location;
        if (!loc) return { lat: null, lng: null };
        return {
            lat: typeof loc.lat === 'function' ? loc.lat() : loc.lat,
            lng: typeof loc.lng === 'function' ? loc.lng() : loc.lng
        };
    }

    // ---------- 추천 검색어 (모든 장소 검색창 공통) ----------
    // 지도 상단 검색창처럼 입력하는 동안 구글 추천 목록을 띄운다.
    function attachAutocomplete(input, onPick) {
        if (!input || input.dataset.ppAutocomplete === '1' || !hasPlaces()) return null;

        let ac;
        try {
            ac = new google.maps.places.Autocomplete(input, { fields: PLACE_FIELDS });
        } catch (e) {
            console.warn('추천 검색어 초기화 실패:', e);
            return null;
        }

        input.dataset.ppAutocomplete = '1';
        input.setAttribute('autocomplete', 'off');

        ac.addListener('place_changed', () => {
            const place = ac.getPlace();
            // 추천을 고르지 않고 엔터만 친 경우는 호출측의 일반 검색에 맡긴다
            if (!place || !place.geometry) return;
            input.dataset.ppPicked = String(Date.now());
            if (typeof onPick === 'function') onPick(place);
        });

        return ac;
    }

    // 추천 목록이 열려 있거나 방금 추천을 고른 직후인지 (엔터 중복 처리 방지)
    function suggestionActive(input) {
        if (document.querySelector('.pac-container .pac-item-selected')) return true;
        const ts = Number(input && input.dataset ? input.dataset.ppPicked || 0 : 0);
        return !!ts && (Date.now() - ts) < 700;
    }

    function releaseAutocompletes() {
        if (typeof google === 'undefined' || !google.maps || !google.maps.event) { _modalAcs = []; return; }
        _modalAcs.forEach(ac => {
            try { google.maps.event.clearInstanceListeners(ac); } catch (e) { /* noop */ }
        });
        _modalAcs = [];
    }

    // ---------- 팝업 본문 ----------
    function buildBody(mode, trip, seed, dayId) {
        const isItinerary = mode === 'itinerary';
        const seedCategory = seed && seed.category ? seed.category : '';

        const catOptions = Object.entries(UI.categoryInfo).map(([key, info]) =>
            `<option value="${key}" ${seedCategory === key ? 'selected' : ''}>${info.icon} ${info.label}</option>`
        ).join('');

        const dayOptions = (trip.days || []).map(d =>
            `<option value="${d.id}" ${dayId === d.id ? 'selected' : ''}>Day ${d.dayNumber}${d.date ? ' (' + d.date + ')' : ''}</option>`
        ).join('');

        const scheduleFields = !isItinerary ? '' : `
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">일차 선택</label>
                    <select id="pp-day">${dayOptions}</select>
                </div>
                <div class="form-group">
                    <label class="form-label">예상 비용</label>
                    <input type="number" id="pp-cost" placeholder="0" />
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">시작 시간</label>
                    <input type="text" class="time-input" inputmode="numeric" maxlength="5" placeholder="--:--" id="pp-start" />
                </div>
                <div class="form-group">
                    <label class="form-label">종료 시간</label>
                    <input type="text" class="time-input" inputmode="numeric" maxlength="5" placeholder="--:--" id="pp-end" />
                </div>
            </div>`;

        const imageField = !isItinerary ? '' : `
            <div class="form-group">
                <label class="form-label">이미지 URL (선택)</label>
                <input type="text" id="pp-image" placeholder="이미지 URL (비우면 자동 검색)" value="${UI.escapeHtml(seed && seed.imageUrl ? seed.imageUrl : '')}" />
                <p class="form-hint">비워두시면 장소명으로 이미지를 자동 검색합니다</p>
            </div>`;

        return `
            <div class="pp-search">
                <label class="form-label pp-search-label">
                    <span class="material-symbols-rounded">search</span>
                    Google Maps에서 장소 검색
                </label>
                <div class="pp-search-row">
                    <input type="text" id="pp-search-input" placeholder="장소명 검색 (예: 도쿄타워, 이치란 라멘)" />
                    <button class="btn-primary btn-sm" id="pp-search-btn" type="button">
                        <span class="material-symbols-rounded">search</span> 검색
                    </button>
                </div>
                <p class="pp-search-hint">입력하는 동안 추천 검색어가 나타납니다</p>
                <div id="pp-results" class="place-add-results" style="display:none"></div>
            </div>

            <div class="pp-divider"><span>또는 Google Maps 링크</span></div>
            <div class="form-group">
                <div class="pp-search-row">
                    <input type="text" id="pp-link" placeholder="Google Maps 링크를 붙여넣으세요" />
                    <button class="btn-outline btn-sm" id="pp-link-btn" type="button">
                        <span class="material-symbols-rounded">link</span> 자동 입력
                    </button>
                </div>
                <div id="pp-link-status" class="pp-link-status" style="display:none"></div>
            </div>

            <div class="pp-divider"><span>직접 입력</span></div>
            <div class="form-group">
                <label class="form-label">장소명 *</label>
                <input type="text" id="pp-title" placeholder="예: 도쿄타워, 을지로 맛집" value="${UI.escapeHtml(seed && seed.title ? seed.title : '')}" />
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">카테고리</label>
                    <select id="pp-category">${catOptions}</select>
                </div>
                <div class="form-group">
                    <label class="form-label">주소</label>
                    <input type="text" id="pp-address" placeholder="주소 또는 위치" value="${UI.escapeHtml(seed && seed.address ? seed.address : '')}" />
                </div>
            </div>
            ${scheduleFields}
            <div class="form-group">
                <label class="form-label">메모</label>
                <textarea id="pp-notes" rows="2" placeholder="참고 사항, 팁 등을 적어주세요">${UI.escapeHtml(seed && seed.notes ? seed.notes : '')}</textarea>
            </div>
            ${imageField}
        `;
    }

    // ---------- 검색 ----------
    function runSearch() {
        const input = document.getElementById('pp-search-input');
        const box = document.getElementById('pp-results');
        if (!input || !box) return;

        const query = input.value.trim();
        if (!query) return;

        box.style.display = 'block';
        box.innerHTML = '<div class="place-add-empty">검색 중...</div>';

        const svc = placesService();
        if (!svc) { geocodeFallback(query); return; }

        const req = { query: query };
        const map = (typeof MapView !== 'undefined' && MapView.getMap) ? MapView.getMap() : null;
        if (map) {
            try { req.location = map.getCenter(); req.radius = 50000; } catch (e) { /* noop */ }
        }

        svc.textSearch(req, (results, status) => {
            if (status === google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
                renderResults(results);
            } else {
                geocodeFallback(query);
            }
        });
    }

    // Places 가 결과를 못 주면 주소 검색으로 대체
    function geocodeFallback(query) {
        if (typeof google === 'undefined' || !google.maps || !google.maps.Geocoder) {
            renderResults([]);
            return;
        }
        let geocoder;
        try { geocoder = new google.maps.Geocoder(); } catch (e) { renderResults([]); return; }

        geocoder.geocode({ address: query }, (results, status) => {
            if (status === 'OK' && results && results.length > 0) {
                renderResults(results.map(r => ({
                    name: query,
                    formatted_address: r.formatted_address,
                    geometry: r.geometry,
                    place_id: r.place_id,
                    types: r.types || [],
                    rating: null,
                    photos: null
                })));
            } else {
                renderResults([]);
            }
        });
    }

    function renderResults(results) {
        const box = document.getElementById('pp-results');
        if (!box) return;

        _results = results || [];
        box.style.display = 'block';

        if (_results.length === 0) {
            box.innerHTML = '<div class="place-add-empty">검색 결과가 없습니다. 다른 이름으로 시도해보세요.</div>';
            return;
        }

        box.innerHTML = _results.slice(0, 15).map((p, i) => {
            const catInfo = UI.categoryInfo[categoryFromTypes(p.types)] || UI.categoryInfo.place;
            const photo = photoUrl(p, 80);
            const thumbStyle = photo
                ? `background-image:url('${photo}');background-size:cover;background-position:center`
                : `background:${catInfo.color}15;color:${catInfo.color}`;
            return `
                <div class="place-add-result" data-pp-index="${i}">
                    <div class="place-add-thumb" style="${thumbStyle}">${photo ? '' : catInfo.icon}</div>
                    <div class="place-add-info">
                        <div class="place-add-name">${UI.escapeHtml(p.name || '')}</div>
                        <div class="place-add-addr">${UI.escapeHtml(p.formatted_address || p.vicinity || '')}</div>
                    </div>
                    ${p.rating ? `<div class="place-add-rating">⭐ ${p.rating}</div>` : ''}
                </div>`;
        }).join('');

        box.querySelectorAll('[data-pp-index]').forEach(el => {
            el.addEventListener('click', () => {
                const place = _results[Number(el.dataset.ppIndex)];
                if (place) applyPlace(place);
            });
        });
    }

    // 선택한 장소를 입력란에 반영 (사용자가 이미 적어둔 값은 지우지 않는다)
    function applyPlace(place) {
        const coords = latLngOf(place);
        const titleEl = document.getElementById('pp-title');
        const addrEl = document.getElementById('pp-address');
        const catEl = document.getElementById('pp-category');
        const imgEl = document.getElementById('pp-image');
        const searchEl = document.getElementById('pp-search-input');
        const box = document.getElementById('pp-results');

        if (titleEl && place.name) titleEl.value = place.name;
        if (addrEl) {
            const addr = place.formatted_address || place.vicinity || '';
            if (addr) addrEl.value = addr;
        }
        if (catEl) catEl.value = categoryFromTypes(place.types);

        const photo = photoUrl(place, 400);
        if (imgEl && photo && !imgEl.value.trim()) imgEl.value = photo;

        _meta = {
            lat: coords.lat,
            lng: coords.lng,
            placeId: place.place_id || '',
            rating: place.rating || null,
            imageUrl: photo || (_meta && _meta.imageUrl) || '',
            candidateVotes: (_meta && _meta.candidateVotes) || []
        };

        if (box) box.style.display = 'none';
        if (searchEl && place.name) searchEl.value = place.name;
        UI.showToast(`"${place.name || '장소'}" 선택됨`, 'success');
    }

    // ---------- Google Maps 링크 파싱 ----------
    function setLinkStatus(message, type) {
        const el = document.getElementById('pp-link-status');
        if (!el) return;
        el.style.display = 'block';
        el.style.background = type === 'success' ? 'rgba(16,185,129,0.1)' : type === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(59,130,246,0.1)';
        el.style.color = type === 'success' ? 'var(--success)' : type === 'error' ? 'var(--danger)' : 'var(--info)';
        el.innerHTML = message;
    }

    async function parseLink() {
        const linkInput = document.getElementById('pp-link');
        if (!linkInput) return;
        const url = linkInput.value.trim();
        if (!url) { UI.showToast('Google Maps 링크를 입력해주세요', 'warning'); return; }

        const parsed = UI.parseGoogleMapsUrl(url);
        if (!parsed) {
            setLinkStatus('⚠️ 유효한 Google Maps 링크가 아닙니다. 구글맵에서 복사한 링크를 붙여넣어주세요.', 'error');
            return;
        }

        setLinkStatus('⏳ 장소 정보를 가져오는 중...', 'info');

        const titleEl = document.getElementById('pp-title');
        const addrEl = document.getElementById('pp-address');
        if (parsed.title && titleEl) titleEl.value = parsed.title;
        if (parsed.address && addrEl) addrEl.value = parsed.address;

        if (parsed.lat && parsed.lng) {
            _meta = {
                lat: parsed.lat,
                lng: parsed.lng,
                placeId: parsed.placeId || '',
                rating: (_meta && _meta.rating) || null,
                imageUrl: (_meta && _meta.imageUrl) || '',
                candidateVotes: (_meta && _meta.candidateVotes) || []
            };

            const geo = await UI.reverseGeocode(parsed.lat, parsed.lng);
            if (geo) {
                if (!parsed.title && geo.name && titleEl) titleEl.value = geo.name;
                if (geo.address && addrEl) addrEl.value = geo.address;
            }
            setLinkStatus(
                `✅ 장소 정보를 가져왔습니다!<br><strong>${UI.escapeHtml(titleEl ? titleEl.value : '')}</strong>` +
                `<br><span style="font-size:0.75rem;opacity:0.7">📍 ${parsed.lat.toFixed(5)}, ${parsed.lng.toFixed(5)}</span>`,
                'success'
            );
        } else if (parsed.title) {
            setLinkStatus(`✅ 장소명을 가져왔습니다: <strong>${UI.escapeHtml(parsed.title)}</strong>` +
                `<br><span style="font-size:0.75rem;opacity:0.7">주소와 추가 정보를 직접 입력해주세요</span>`, 'success');
        } else {
            setLinkStatus('⚠️ 링크에서 장소 정보를 추출하지 못했습니다. 직접 입력해주세요.', 'error');
        }
    }

    // ---------- 저장 ----------
    function save() {
        if (!_ctx) return;
        const trip = Store.getCurrentTrip();
        if (!trip) { UI.showToast('여행 정보를 찾을 수 없습니다', 'warning'); return; }

        const titleEl = document.getElementById('pp-title');
        const title = titleEl ? titleEl.value.trim() : '';
        if (!title) {
            UI.showToast('장소명을 입력해주세요', 'warning');
            if (titleEl) titleEl.focus();
            return;
        }

        const category = document.getElementById('pp-category').value;
        const address = document.getElementById('pp-address').value.trim();
        const notes = document.getElementById('pp-notes').value.trim();
        const meta = _meta || {};

        if (_ctx.mode === 'candidate') {
            Store.addCandidate(trip.id, {
                title, category, address, notes,
                lat: meta.lat || null,
                lng: meta.lng || null,
                placeId: meta.placeId || '',
                rating: meta.rating || null,
                imageUrl: meta.imageUrl || ''
            });
            Store.addActivity(trip.id, '후보 추가', `"${title}" 후보 추가`);
            finish(`"${title}" 후보에 추가됨`);
            return;
        }

        // 일정(장소) 추가
        const daySel = document.getElementById('pp-day');
        const dayId = daySel ? daySel.value : _ctx.dayId;
        if (!dayId) { UI.showToast('일차를 선택해주세요', 'warning'); return; }

        const imgEl = document.getElementById('pp-image');
        const imageUrl = (imgEl && imgEl.value.trim()) || meta.imageUrl || UI.getPlaceImage(title, category);

        const item = Store.addItineraryItem(trip.id, dayId, {
            title, category, address, notes, imageUrl,
            startTime: document.getElementById('pp-start').value,
            endTime: document.getElementById('pp-end').value,
            cost: Number(document.getElementById('pp-cost').value) || 0,
            lat: meta.lat || null,
            lng: meta.lng || null,
            placeId: meta.placeId || null,
            candidateVotes: meta.candidateVotes || []
        });

        // 지정한 위치로 삽입 (방금 추가된 항목은 맨 뒤에 있다)
        if (item && _ctx.insertIndex !== null) {
            const day = trip.days.find(d => d.id === dayId);
            if (day && day.items.length > 1) {
                const moved = day.items.pop();
                const at = Math.max(0, Math.min(_ctx.insertIndex, day.items.length));
                day.items.splice(at, 0, moved);
                Store.save();
            }
        }

        // 후보에서 일정으로 옮긴 경우 원본 후보 제거
        if (_ctx.removeCandidateId) Store.removeCandidate(trip.id, _ctx.removeCandidateId);

        Store.addActivity(trip.id, '일정 추가', `"${title}" 추가`);
        finish(`"${title}" 일정에 추가됨`);
    }

    function finish(message) {
        const onSaved = _ctx && _ctx.onSaved;
        UI.closeModal();
        UI.showToast(message, 'success');
        _ctx = null;
        _meta = null;
        _results = [];
        if (onSaved) {
            try { onSaved(); } catch (e) { console.warn('저장 후 갱신 실패:', e); }
        }
    }

    // ---------- 열기 ----------
    function bind() {
        const input = document.getElementById('pp-search-input');
        const searchBtn = document.getElementById('pp-search-btn');
        if (!input || !searchBtn) return;

        const ac = attachAutocomplete(input, applyPlace);
        if (ac) _modalAcs.push(ac);

        searchBtn.onclick = runSearch;
        input.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            // 추천 검색어를 고르는 중이면 그쪽에 맡긴다
            if (suggestionActive(input)) return;
            runSearch();
        });

        const linkInput = document.getElementById('pp-link');
        const linkBtn = document.getElementById('pp-link-btn');
        if (linkBtn) linkBtn.onclick = parseLink;
        if (linkInput) {
            linkInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); parseLink(); }
            });
            linkInput.addEventListener('paste', () => setTimeout(parseLink, 100));
        }

        const saveBtn = document.getElementById('pp-save');
        if (saveBtn) saveBtn.onclick = save;

        input.focus();
    }

    function open(opts) {
        opts = opts || {};
        const mode = opts.mode === 'candidate' ? 'candidate' : 'itinerary';

        const trip = Store.getCurrentTrip();
        if (!trip) { UI.showToast('먼저 여행을 생성해주세요', 'warning'); return; }
        if (mode === 'itinerary' && (!trip.days || trip.days.length === 0)) {
            UI.showToast('먼저 일정(Day)을 추가해주세요', 'warning');
            return;
        }

        releaseAutocompletes();

        const seed = opts.place || null;
        _results = [];
        _meta = {
            lat: seed && seed.lat != null ? seed.lat : null,
            lng: seed && seed.lng != null ? seed.lng : null,
            placeId: (seed && seed.placeId) || '',
            rating: seed && seed.rating != null ? seed.rating : null,
            imageUrl: (seed && seed.imageUrl) || '',
            candidateVotes: (seed && seed.candidateVotes) || []
        };

        const dayId = opts.dayId || ((trip.days && trip.days[0]) ? trip.days[0].id : null);
        _ctx = {
            mode,
            dayId,
            insertIndex: (typeof opts.insertIndex === 'number') ? opts.insertIndex : null,
            removeCandidateId: opts.removeCandidateId || null,
            onSaved: typeof opts.onSaved === 'function' ? opts.onSaved : null
        };

        if (typeof Presence !== 'undefined') {
            const focusLabel = mode === 'itinerary' ? '장소 추가 중' : '후보 추가 중';
            if (mode === 'itinerary' && opts.dayId) Presence.setFocus('day', opts.dayId, focusLabel);
            else Presence.setFocus('page', '', focusLabel);
        }

        UI.showModal(
            mode === 'itinerary' ? '장소 추가' : '일정 후보 추가',
            buildBody(mode, trip, seed, dayId),
            `<button class="btn-outline" onclick="UI.closeModal()">취소</button>
             <button class="btn-primary" id="pp-save">추가</button>`,
            { onOpen: bind }
        );
    }

    return { open, attachAutocomplete, suggestionActive, categoryFromTypes };
})();
