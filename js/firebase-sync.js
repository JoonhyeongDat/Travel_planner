/* ===================================
   트래블메이트 - Firebase 실시간 동기화
   다중 사용자 협업 지원
   =================================== */

const FirebaseSync = (() => {
    let db = null;
    let _listening = false;
    let _suppressRemote = false;
    let _lastWriteTime = 0;
    let _initialFire = true; // onValue 최초 발생 무시용
    let _debounceTimer = null;
    let _ready = false; // pullData 완료 전까지 push 차단

    function init() {
        try {
            if (typeof firebase === 'undefined') {
                console.warn('[Firebase] SDK 로드 안됨, 오프라인 모드');
                return false;
            }
            const firebaseConfig = {
                apiKey: "AIzaSyDdhNUCqWtn3Dhsf7VDPOlKvAb_qkuGVVw",
                authDomain: "travel-planner-e290f.firebaseapp.com",
                databaseURL: "https://travel-planner-e290f-default-rtdb.asia-southeast1.firebasedatabase.app",
                projectId: "travel-planner-e290f",
                storageBucket: "travel-planner-e290f.firebasestorage.app",
                messagingSenderId: "75574492691",
                appId: "1:75574492691:web:9eb95724f6a9099d6949e6"
            };

            firebase.initializeApp(firebaseConfig);
            db = firebase.database();
            console.log('[Firebase] 초기화 완료');
            return true;
        } catch (e) {
            console.error('[Firebase] 초기화 실패:', e);
            return false;
        }
    }

    // Firebase는 빈 배열([])을 저장하지 않으므로 복원 필요
    function sanitizeTrip(trip) {
        if (!trip) return trip;
        trip.days = ensureArray(trip.days);
        trip.reservations = ensureArray(trip.reservations);
        trip.expenses = ensureArray(trip.expenses);
        trip.members = ensureArray(trip.members);
        trip.checklist = ensureArray(trip.checklist);
        trip.journals = ensureArray(trip.journals);
        trip.favorites = ensureArray(trip.favorites);
        trip.candidates = ensureArray(trip.candidates);
        trip.courseCandidates = ensureArray(trip.courseCandidates);
        trip.activityLog = ensureArray(trip.activityLog);
        // days 내부 items 배열 복원
        trip.days.forEach(day => {
            day.items = ensureArray(day.items);
            day.items.forEach(item => {
                item.comments = ensureArray(item.comments);
                item.candidateVotes = ensureArray(item.candidateVotes);
            });
        });
        // candidates 내부 votes 배열 복원
        trip.candidates.forEach(c => { c.votes = ensureArray(c.votes); });
        trip.courseCandidates.forEach(c => {
            c.votes = ensureArray(c.votes);
            c.candidateIds = ensureArray(c.candidateIds);
        });
        // checklist 내부 items 배열 복원
        trip.checklist.forEach(cat => {
            cat.items = ensureArray(cat.items);
        });
        // reservations 내부 details 객체 복원
        trip.reservations.forEach(res => {
            if (!res.details) res.details = {};
        });
        // expenses 내부 splitAmong 배열 복원
        trip.expenses.forEach(exp => {
            exp.splitAmong = ensureArray(exp.splitAmong);
        });
        return trip;
    }

    // Firebase에서 배열이 객체로 변환될 수 있으므로 배열로 복원
    function ensureArray(val) {
        if (Array.isArray(val)) return val;
        if (val === null || val === undefined) return [];
        if (typeof val === 'object') return Object.values(val);
        return [];
    }

    function sanitizeData(data) {
        if (!data) return data;
        data.trips = ensureArray(data.trips);
        data.trips = data.trips.map(t => sanitizeTrip(t));
        if (!data.settings) data.settings = {};
        return data;
    }

    function setReady(val) { _ready = val; }

    // 전체 데이터를 Firebase에 저장
    function pushData(data) {
        if (!db || !_ready) return;
        _suppressRemote = true;
        _lastWriteTime = Date.now();
        const cleanData = JSON.parse(JSON.stringify(data));
        db.ref('appData').set(cleanData)
            .then(() => {
                console.log('[Firebase] 데이터 저장 완료');
                setTimeout(() => { _suppressRemote = false; }, 1000);
            })
            .catch(err => {
                console.error('[Firebase] 저장 실패:', err);
                _suppressRemote = false;
            });
    }

    // Firebase에서 실시간 변경 감지
    function startListening(onDataReceived) {
        if (!db || _listening) return;
        _listening = true;
        _initialFire = true;

        db.ref('appData').on('value', (snapshot) => {
            // 최초 발생 무시 (pullData로 이미 처리됨)
            if (_initialFire) {
                _initialFire = false;
                return;
            }
            if (_suppressRemote) return;
            if (Date.now() - _lastWriteTime < 1000) return;

            const remoteData = snapshot.val();
            if (!remoteData) return;

            // 디바운스: 빠른 연속 변경 시 마지막 것만 반영
            clearTimeout(_debounceTimer);
            _debounceTimer = setTimeout(() => {
                console.log('[Firebase] 원격 데이터 수신');
                onDataReceived(sanitizeData(remoteData));
            }, 300);
        });
    }

    // Firebase에서 최초 데이터 가져오기
    async function pullData() {
        if (!db) return null;
        try {
            const snapshot = await db.ref('appData').once('value');
            const data = snapshot.val();
            return data ? sanitizeData(data) : null;
        } catch (e) {
            console.error('[Firebase] 데이터 가져오기 실패:', e);
            return null;
        }
    }


    // ===================================
    //  병합 (초기 동기화 전용)
    //  원칙: 한쪽에만 있는 데이터는 절대 버리지 않는다.
    //  같은 id가 양쪽에 있으면 updatedAt이 최신인 쪽 값을 쓴다.
    // ===================================

    // id 기준 합집합. mergeItem이 있으면 양쪽에 있는 항목을 재귀 병합
    function unionById(newerArr, olderArr, mergeItem) {
        const newer = ensureArray(newerArr);
        const older = ensureArray(olderArr);
        const all = newer.concat(older);
        const hasIds = all.length > 0 && all.every(e => e && typeof e === 'object' && e.id);

        // 투표 memberId 배열처럼 id가 없는 값들은 값 기준 합집합
        if (!hasIds) {
            const seen = new Set();
            const out = [];
            all.forEach(v => {
                const key = (v !== null && typeof v === 'object') ? JSON.stringify(v) : String(v);
                if (!seen.has(key)) { seen.add(key); out.push(v); }
            });
            return out;
        }

        const olderMap = new Map(older.map(e => [e.id, e]));
        const out = newer.map(n => {
            const o = olderMap.get(n.id);
            olderMap.delete(n.id);
            if (!o) return n;
            return mergeItem ? mergeItem(n, o) : { ...o, ...n };
        });
        olderMap.forEach(o => out.push(o)); // 오래된 쪽에만 있던 것도 살림
        return out;
    }

    function mergeItineraryItem(n, o) {
        return {
            ...o, ...n,
            comments: unionById(n.comments, o.comments),
            candidateVotes: unionById(n.candidateVotes, o.candidateVotes)
        };
    }

    function mergeDay(n, o) {
        return { ...o, ...n, items: unionById(n.items, o.items, mergeItineraryItem) };
    }

    function mergeChecklistCategory(n, o) {
        return { ...o, ...n, items: unionById(n.items, o.items) };
    }

    // 후보 / 코스후보: 투표는 양쪽 합집합
    function mergeVotable(n, o) {
        const merged = { ...o, ...n, votes: unionById(n.votes, o.votes) };
        if (n.candidateIds || o.candidateIds) {
            merged.candidateIds = unionById(n.candidateIds, o.candidateIds);
        }
        return merged;
    }

    function mergeActivityLog(a, b) {
        const merged = unionById(a, b);
        merged.sort((x, y) => String(y.timestamp || '').localeCompare(String(x.timestamp || '')));
        return merged.slice(0, 100);
    }

    // 여행 하나를 병합. updatedAt이 최신인 쪽이 스칼라 필드(이름/날짜 등) 우선
    function mergeTrip(tripA, tripB) {
        if (!tripA) return tripB;
        if (!tripB) return tripA;
        const a = sanitizeTrip(JSON.parse(JSON.stringify(tripA)));
        const b = sanitizeTrip(JSON.parse(JSON.stringify(tripB)));
        const stampA = a.updatedAt || a.createdAt || '';
        const stampB = b.updatedAt || b.createdAt || '';
        const n = stampA >= stampB ? a : b; // newer
        const o = stampA >= stampB ? b : a; // older

        const days = unionById(n.days, o.days, mergeDay);
        days.sort((x, y) => (x.dayNumber || 0) - (y.dayNumber || 0));

        return {
            ...o, ...n,
            days,
            members: unionById(n.members, o.members),
            reservations: unionById(n.reservations, o.reservations),
            expenses: unionById(n.expenses, o.expenses),
            checklist: unionById(n.checklist, o.checklist, mergeChecklistCategory),
            journals: unionById(n.journals, o.journals),
            favorites: unionById(n.favorites, o.favorites),
            candidates: unionById(n.candidates, o.candidates, mergeVotable),
            courseCandidates: unionById(n.courseCandidates, o.courseCandidates, mergeVotable),
            activityLog: mergeActivityLog(n.activityLog, o.activityLog)
        };
    }

    // 로컬 + 원격 전체 병합. settings는 기기별 설정이므로 항상 로컬 우선
    function mergeData(localData, remoteData) {
        const local = sanitizeData(JSON.parse(JSON.stringify(localData || {}))) || {};
        const remote = sanitizeData(JSON.parse(JSON.stringify(remoteData || {}))) || {};

        const remoteMap = new Map(ensureArray(remote.trips).map(t => [t.id, t]));
        const trips = ensureArray(local.trips).map(lt => {
            const rt = remoteMap.get(lt.id);
            remoteMap.delete(lt.id);
            return rt ? mergeTrip(lt, rt) : lt;
        });
        remoteMap.forEach(rt => trips.push(rt)); // 원격에만 있는 여행도 유지

        return {
            ...remote, ...local,
            trips,
            currentTripId: local.currentTripId || remote.currentTripId || null,
            settings: { ...(remote.settings || {}), ...(local.settings || {}) }
        };
    }

    function isConnected() {
        return db !== null;
    }

    return {
        init,
        pushData,
        startListening,
        pullData,
        isConnected,
        setReady,
        mergeData,
        mergeTrip
    };
})();
