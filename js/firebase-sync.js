/* ===================================
   트래블메이트 - Firebase 실시간 동기화
   다중 사용자 협업 지원
   =================================== */

const FirebaseSync = (() => {
    let db = null;
    let _listening = false;
    let _suppressRemote = false; // 내 변경 시 원격 리스너 무시
    let _lastWriteTime = 0;

    function init() {
        try {
            const firebaseConfig = {
                apiKey: "AIzaSyDdhNUCqWtn3Dhsf7VDPOlKvAb_qkuGVVw",
                authDomain: "travel-planner-e290f.firebaseapp.com",
                databaseURL: "https://travel-planner-e290f-default-rtdb.asia-southeast1.firebasedatabase.app",
                projectId: "travel-planner-e290f",
                storageBucket: "travel-planner-e290f.firebasestorage.app",
                messagingSenderId: "75574492691",
                appId: "1:75574492691:web:9eb95724f6a9099d6949e6"
            };

            const app = firebase.initializeApp(firebaseConfig);
            db = firebase.database();
            console.log('[Firebase] 초기화 완료');
            return true;
        } catch (e) {
            console.error('[Firebase] 초기화 실패:', e);
            return false;
        }
    }

    // 전체 데이터를 Firebase에 저장
    function pushData(data) {
        if (!db) return;
        _suppressRemote = true;
        _lastWriteTime = Date.now();
        const cleanData = JSON.parse(JSON.stringify(data)); // 순환 참조 방지
        db.ref('appData').set(cleanData)
            .then(() => {
                console.log('[Firebase] 데이터 저장 완료');
                setTimeout(() => { _suppressRemote = false; }, 500);
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

        db.ref('appData').on('value', (snapshot) => {
            if (_suppressRemote) return; // 내 변경은 무시

            const remoteData = snapshot.val();
            if (!remoteData) return;

            // 내가 방금 쓴 데이터면 무시 (500ms 이내)
            if (Date.now() - _lastWriteTime < 500) return;

            console.log('[Firebase] 원격 데이터 수신');
            onDataReceived(remoteData);
        });
    }

    // Firebase에서 최초 데이터 가져오기
    async function pullData() {
        if (!db) return null;
        try {
            const snapshot = await db.ref('appData').once('value');
            return snapshot.val();
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
        isConnected
    };
})();
