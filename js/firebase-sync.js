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
        trip.activityLog = ensureArray(trip.activityLog);
        // days 내부 items 배열 복원
        trip.days.forEach(day => {
            day.items = ensureArray(day.items);
            day.items.forEach(item => {
                item.comments = ensureArray(item.comments);
            });
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

    function isConnected() {
        return db !== null;
    }

    return {
        init,
        pushData,
        startListening,
        pullData,
        isConnected,
        setReady
    };
})();
