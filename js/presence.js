/* ===================================
   트래블메이트 - 실시간 접속자 표시 (Presence)
   누가 접속해 어느 화면·어느 항목을 보고 있는지 공유
   =================================== */

const Presence = (() => {
    const STALE_MS = 60000;      // 이 시간 넘게 소식 없으면 접속 종료로 간주
    const HEARTBEAT_MS = 20000;  // 살아있음 갱신 주기
    const PAGE_LABELS = {
        dashboard: '대시보드', itinerary: '일정표', map: '지도', budget: '가계부',
        reservations: '예약', checklist: '체크리스트', journal: '메모',
        members: '멤버', settings: '설정'
    };

    let db = null;
    let myRef = null;
    let clientId = null;
    let heartbeat = null;
    let applying = false;   // 배지 삽입 중 발생한 DOM 변경 무시용
    let observer = null;
    let state = { page: 'dashboard', focus: null };
    let others = [];

    // 탭마다 별개의 참여자로 취급 (같은 사람이 두 탭을 열 수도 있음)
    function makeClientId() {
        try {
            let id = sessionStorage.getItem('travelmate_client_id');
            if (!id) {
                id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
                sessionStorage.setItem('travelmate_client_id', id);
            }
            return id;
        } catch (e) {
            return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
        }
    }

    // 내 신원: 선택한 멤버가 있으면 그 이름·색상을 쓰고, 없으면 게스트
    function identity() {
        const settings = Store.getSettings() || {};
        const trip = Store.getCurrentTrip();
        const member = trip && (trip.members || []).find(m => m.id === settings.myMemberId);
        const name = (member && member.name) || settings.userName || '게스트';
        return {
            memberId: (member && member.id) || null,
            name: name,
            avatar: (member && member.avatar) || name.charAt(0),
            color: (member && member.color) || '#94A3B8'
        };
    }

    function init() {
        if (typeof firebase === 'undefined' || !firebase.apps || !firebase.apps.length) return false;
        try {
            db = firebase.database();
            clientId = makeClientId();
            myRef = db.ref('presence/' + clientId);
            myRef.onDisconnect().remove();

            db.ref('presence').on('value', (snap) => {
                const all = snap.val() || {};
                const now = Date.now();
                others = Object.keys(all)
                    .filter(k => k !== clientId)
                    .map(k => all[k])
                    .filter(p => p && p.updatedAt && (now - p.updatedAt) < STALE_MS);
                render();
            });

            window.addEventListener('beforeunload', () => { try { myRef.remove(); } catch (e) { } });
            document.addEventListener('visibilitychange', () => { if (!document.hidden) push(); });
            heartbeat = setInterval(push, HEARTBEAT_MS);

            // 페이지가 다시 그려져도 배지가 유지되도록 감시
            const container = document.getElementById('page-container');
            if (container && typeof MutationObserver !== 'undefined') {
                let timer = null;
                observer = new MutationObserver(() => {
                    if (applying) return;
                    clearTimeout(timer);
                    timer = setTimeout(applyBadges, 150);
                });
                observer.observe(container, { childList: true, subtree: true });
            }

            push();
            return true;
        } catch (e) {
            console.warn('[Presence] 초기화 실패:', e);
            return false;
        }
    }

    function push() {
        if (!myRef) return;
        const trip = Store.getCurrentTrip();
        const who = identity();
        myRef.set({
            clientId: clientId,
            memberId: who.memberId,
            name: who.name,
            avatar: who.avatar,
            color: who.color,
            tripId: (trip && trip.id) || null,
            tripName: (trip && trip.name) || null,
            page: state.page,
            focus: state.focus || null,
            updatedAt: Date.now()
        }).catch(() => { });
    }

    function setPage(page) {
        state.page = page || 'dashboard';
        state.focus = null;
        push();
    }

    // type: 'item' | 'day' | 'candidate' | 'page'
    function setFocus(type, id, label) {
        state.focus = { type: type, id: id || '', label: label || '' };
        push();
    }

    function clearFocus() {
        if (!state.focus) return;
        state.focus = null;
        push();
    }

    // 지금 이 여행을 함께 보고 있는 사람만 배지 대상
    function sameTrip() {
        const trip = Store.getCurrentTrip();
        if (!trip) return [];
        return others.filter(p => p.tripId === trip.id);
    }

    function describe(p) {
        const page = PAGE_LABELS[p.page] || p.page || '';
        if (p.focus && p.focus.label) return page + ' · ' + p.focus.label;
        return p.tripName ? p.tripName + ' · ' + page : page;
    }

    function esc(s) {
        return (typeof UI !== 'undefined' && UI.escapeHtml) ? UI.escapeHtml(String(s || '')) : String(s || '');
    }

    function render() {
        renderBar();
        applyBadges();
    }

    function renderBar() {
        const bar = document.getElementById('presence-bar');
        if (!bar) return;
        if (!others.length) {
            bar.innerHTML = '';
            bar.style.display = 'none';
            return;
        }
        bar.style.display = 'flex';
        bar.innerHTML = others.slice(0, 6).map(p => `
            <div class="presence-avatar" style="background:${esc(p.color)}" data-tip="${esc(p.name)} — ${esc(describe(p))}">
                <span>${esc(p.avatar || p.name.charAt(0))}</span>
            </div>
        `).join('') + `<span class="presence-count">${others.length}명 접속중</span>`;
    }

    function applyBadges() {
        applying = true;
        document.querySelectorAll('.presence-badge').forEach(el => el.remove());
        document.querySelectorAll('.presence-editing').forEach(el => el.classList.remove('presence-editing'));

        sameTrip().forEach(p => {
            if (!p.focus || !p.focus.id) return;
            let target = null;
            const id = String(p.focus.id).replace(/[^A-Za-z0-9_-]/g, '');
            if (!id) return;
            if (p.focus.type === 'item') target = document.querySelector('[data-item-id="' + id + '"]');
            else if (p.focus.type === 'day') target = document.querySelector('.day-card[data-day-id="' + id + '"]');
            else if (p.focus.type === 'candidate') target = document.querySelector('[data-candidate-id="' + id + '"]');
            if (!target) return;

            target.classList.add('presence-editing');
            target.style.setProperty('--presence-color', p.color);
            const badge = document.createElement('span');
            badge.className = 'presence-badge';
            badge.style.background = p.color;
            badge.innerHTML = '<span class="presence-badge-avatar">' + esc(p.avatar || p.name.charAt(0)) + '</span>' + esc(p.name) + ' 수정중';
            target.appendChild(badge);
        });

        setTimeout(() => { applying = false; }, 0);
    }

    return {
        init,
        setPage,
        setFocus,
        clearFocus,
        getOthers: () => others.slice(),
        refresh: push
    };
})();
