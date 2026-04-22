/* ===================================
   트래블메이트 - 데이터 스토어
   로컬 스토리지 기반 상태 관리
   =================================== */

const Store = (() => {
    const STORAGE_KEY = 'travelmate_data';

    // 기본 데이터 구조
    const defaultData = {
        currentTripId: null,
        trips: [],
        settings: {
            theme: 'city',
            currency: 'KRW',
            currencySymbol: '₩',
            userName: '나',
            language: 'ko',
            myMemberId: null
        }
    };

    // 새 여행 템플릿
    function createTrip(name, destination, startDate, endDate, theme) {
        return {
            id: generateId(),
            name: name || '새로운 여행',
            destination: destination || '',
            startDate: startDate || '',
            endDate: endDate || '',
            theme: theme || 'city',
            coverImage: '',
            totalBudget: 0,
            days: [],
            reservations: [],
            expenses: [],
            members: [
                {
                    id: generateId(),
                    name: '나',
                    color: '#4F46E5',
                    role: '관리자',
                    avatar: '나'
                }
            ],
            checklist: [],
            journals: [],
            favorites: [],
            candidates: [],
            activityLog: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
    }

    // 새 일차 템플릿
    function createDay(dayNumber, date) {
        return {
            id: generateId(),
            dayNumber: dayNumber,
            date: date || '',
            title: `${dayNumber}일차`,
            items: []
        };
    }

    // 새 일정 아이템 템플릿
    function createItineraryItem(data = {}) {
        return {
            id: generateId(),
            title: data.title || '',
            category: data.category || 'place', // place, food, activity, transport, accommodation, shopping
            startTime: data.startTime || '',
            endTime: data.endTime || '',
            address: data.address || '',
            lat: data.lat || null,
            lng: data.lng || null,
            placeId: data.placeId || null,
            imageUrl: data.imageUrl || '',
            notes: data.notes || '',
            cost: data.cost || 0,
            travelMode: data.travelMode || '', // walking, driving, transit
            travelDuration: data.travelDuration || '',
            travelInfo: data.travelInfo || null, // { walking: {duration,distance}, driving: {...}, transit: {...}, selectedMode: 'walking'|'driving'|'transit' }
            comments: [],
            isFavorite: false,
            createdAt: new Date().toISOString()
        };
    }

    // 새 예약 템플릿
    function createReservation(data = {}) {
        return {
            id: generateId(),
            type: data.type || 'hotel', // flight, train, hotel, restaurant, ticket, transport, other
            name: data.name || '',
            confirmationNumber: data.confirmationNumber || '',
            date: data.date || '',
            time: data.time || '',
            endDate: data.endDate || '',
            endTime: data.endTime || '',
            location: data.location || '',
            address: data.address || '',
            notes: data.notes || '',
            cost: data.cost || 0,
            status: data.status || 'confirmed', // confirmed, pending, cancelled
            details: data.details || {},
            createdAt: new Date().toISOString()
        };
    }

    // 새 지출 템플릿
    function createExpense(data = {}) {
        return {
            id: generateId(),
            name: data.name || '',
            amount: data.amount || 0,
            category: data.category || 'food', // food, transport, accommodation, activity, shopping, etc
            date: data.date || new Date().toISOString().split('T')[0],
            paidBy: data.paidBy || '',
            splitAmong: data.splitAmong || [], // member IDs
            splitType: data.splitType || 'equal', // equal, custom
            notes: data.notes || '',
            createdAt: new Date().toISOString()
        };
    }

    // 새 체크리스트 카테고리 템플릿
    function createChecklistCategory(name, icon) {
        return {
            id: generateId(),
            name: name || '새 카테고리',
            icon: icon || '📋',
            items: []
        };
    }

    // 새 체크리스트 아이템
    function createChecklistItem(text, assignee) {
        return {
            id: generateId(),
            text: text || '',
            checked: false,
            assignee: assignee || '',
            createdAt: new Date().toISOString()
        };
    }

    // 새 메모 템플릿
    function createJournal(data = {}) {
        return {
            id: generateId(),
            title: data.title || '',
            content: data.content || '',
            tags: data.tags || [],
            author: data.author || '나',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
    }

    // 유틸리티
    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }

    // 데이터 로드
    function load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                return { ...defaultData, ...parsed };
            }
        } catch (e) {
            console.error('데이터 로드 실패:', e);
        }
        return { ...defaultData };
    }

    // 데이터 저장
    function save(data) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
            // Firebase 실시간 동기화
            if (typeof FirebaseSync !== 'undefined' && FirebaseSync.isConnected()) {
                FirebaseSync.pushData(data);
            }
        } catch (e) {
            console.error('데이터 저장 실패:', e);
        }
    }

    // 현재 데이터
    let _data = load();

    return {
        // 전체 데이터 접근
        getData: () => _data,

        // 설정
        getSettings: () => _data.settings,
        updateSettings: (updates) => {
            _data.settings = { ..._data.settings, ...updates };
            save(_data);
        },

        // 여행 CRUD
        getTrips: () => _data.trips,
        getCurrentTrip: () => {
            return _data.trips.find(t => t.id === _data.currentTripId) || null;
        },
        setCurrentTrip: (tripId) => {
            _data.currentTripId = tripId;
            save(_data);
        },
        addTrip: (name, destination, startDate, endDate, theme) => {
            const trip = createTrip(name, destination, startDate, endDate, theme);
            _data.trips.push(trip);
            _data.currentTripId = trip.id;
            save(_data);
            return trip;
        },
        updateTrip: (tripId, updates) => {
            const trip = _data.trips.find(t => t.id === tripId);
            if (trip) {
                Object.assign(trip, updates, { updatedAt: new Date().toISOString() });
                save(_data);
            }
            return trip;
        },
        deleteTrip: (tripId) => {
            _data.trips = _data.trips.filter(t => t.id !== tripId);
            if (_data.currentTripId === tripId) {
                _data.currentTripId = _data.trips.length > 0 ? _data.trips[0].id : null;
            }
            save(_data);
        },

        // 일정 관리
        addDay: (tripId) => {
            const trip = _data.trips.find(t => t.id === tripId);
            if (!trip) return null;
            const dayNum = trip.days.length + 1;
            let date = '';
            if (trip.startDate) {
                const start = new Date(trip.startDate);
                start.setDate(start.getDate() + dayNum - 1);
                date = start.toISOString().split('T')[0];
            }
            const day = createDay(dayNum, date);
            trip.days.push(day);
            save(_data);
            return day;
        },
        removeDay: (tripId, dayId) => {
            const trip = _data.trips.find(t => t.id === tripId);
            if (!trip) return;
            trip.days = trip.days.filter(d => d.id !== dayId);
            // 번호 재정렬
            trip.days.forEach((d, i) => {
                d.dayNumber = i + 1;
                d.title = `${i + 1}일차`;
            });
            save(_data);
        },
        addItineraryItem: (tripId, dayId, data) => {
            const trip = _data.trips.find(t => t.id === tripId);
            if (!trip) return null;
            const day = trip.days.find(d => d.id === dayId);
            if (!day) return null;
            const item = createItineraryItem(data);
            day.items.push(item);
            save(_data);
            return item;
        },
        updateItineraryItem: (tripId, dayId, itemId, updates) => {
            const trip = _data.trips.find(t => t.id === tripId);
            if (!trip) return;
            const day = trip.days.find(d => d.id === dayId);
            if (!day) return;
            const item = day.items.find(i => i.id === itemId);
            if (item) {
                Object.assign(item, updates);
                save(_data);
            }
        },
        removeItineraryItem: (tripId, dayId, itemId) => {
            const trip = _data.trips.find(t => t.id === tripId);
            if (!trip) return;
            const day = trip.days.find(d => d.id === dayId);
            if (!day) return;
            day.items = day.items.filter(i => i.id !== itemId);
            save(_data);
        },
        moveItineraryItem: (tripId, fromDayId, toDayId, itemId, newIndex) => {
            const trip = _data.trips.find(t => t.id === tripId);
            if (!trip) return;
            const fromDay = trip.days.find(d => d.id === fromDayId);
            const toDay = trip.days.find(d => d.id === toDayId);
            if (!fromDay || !toDay) return;
            const itemIndex = fromDay.items.findIndex(i => i.id === itemId);
            if (itemIndex === -1) return;
            const [item] = fromDay.items.splice(itemIndex, 1);
            toDay.items.splice(newIndex, 0, item);
            save(_data);
        },
        reorderDays: (tripId, fromIndex, toIndex) => {
            const trip = _data.trips.find(t => t.id === tripId);
            if (!trip) return;
            const [day] = trip.days.splice(fromIndex, 1);
            trip.days.splice(toIndex, 0, day);
            trip.days.forEach((d, i) => {
                d.dayNumber = i + 1;
                d.title = `${i + 1}일차`;
            });
            save(_data);
        },
        addComment: (tripId, dayId, itemId, text, author) => {
            const trip = _data.trips.find(t => t.id === tripId);
            if (!trip) return;
            const day = trip.days.find(d => d.id === dayId);
            if (!day) return;
            const item = day.items.find(i => i.id === itemId);
            if (!item) return;
            item.comments.push({
                id: generateId(),
                text,
                author: author || '나',
                createdAt: new Date().toISOString()
            });
            save(_data);
        },

        // 예약 관리
        addReservation: (tripId, data) => {
            const trip = _data.trips.find(t => t.id === tripId);
            if (!trip) return null;
            const reservation = createReservation(data);
            trip.reservations.push(reservation);
            save(_data);
            return reservation;
        },
        updateReservation: (tripId, resId, updates) => {
            const trip = _data.trips.find(t => t.id === tripId);
            if (!trip) return;
            const res = trip.reservations.find(r => r.id === resId);
            if (res) {
                Object.assign(res, updates);
                save(_data);
            }
        },
        removeReservation: (tripId, resId) => {
            const trip = _data.trips.find(t => t.id === tripId);
            if (!trip) return;
            trip.reservations = trip.reservations.filter(r => r.id !== resId);
            save(_data);
        },

        // 예산/지출 관리
        addExpense: (tripId, data) => {
            const trip = _data.trips.find(t => t.id === tripId);
            if (!trip) return null;
            const expense = createExpense(data);
            trip.expenses.push(expense);
            save(_data);
            return expense;
        },
        updateExpense: (tripId, expId, updates) => {
            const trip = _data.trips.find(t => t.id === tripId);
            if (!trip) return;
            const exp = trip.expenses.find(e => e.id === expId);
            if (exp) {
                Object.assign(exp, updates);
                save(_data);
            }
        },
        removeExpense: (tripId, expId) => {
            const trip = _data.trips.find(t => t.id === tripId);
            if (!trip) return;
            trip.expenses = trip.expenses.filter(e => e.id !== expId);
            save(_data);
        },
        getTotalExpenses: (tripId) => {
            const trip = _data.trips.find(t => t.id === tripId);
            if (!trip) return 0;
            return trip.expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
        },
        getExpensesByCategory: (tripId) => {
            const trip = _data.trips.find(t => t.id === tripId);
            if (!trip) return {};
            const cats = {};
            trip.expenses.forEach(e => {
                if (!cats[e.category]) cats[e.category] = 0;
                cats[e.category] += Number(e.amount) || 0;
            });
            return cats;
        },
        getSettlement: (tripId) => {
            const trip = _data.trips.find(t => t.id === tripId);
            if (!trip || trip.members.length === 0) return [];

            // 각 멤버별 지불/부담 계산
            const balances = {};
            trip.members.forEach(m => { balances[m.id] = { paid: 0, owe: 0, name: m.name }; });

            trip.expenses.forEach(exp => {
                const amount = Number(exp.amount) || 0;
                if (exp.paidBy && balances[exp.paidBy]) {
                    balances[exp.paidBy].paid += amount;
                }
                const splitMembers = exp.splitAmong.length > 0 ? exp.splitAmong : trip.members.map(m => m.id);
                const share = amount / splitMembers.length;
                splitMembers.forEach(mId => {
                    if (balances[mId]) {
                        balances[mId].owe += share;
                    }
                });
            });

            // 정산 결과 계산
            const netBalances = [];
            Object.keys(balances).forEach(id => {
                netBalances.push({
                    id,
                    name: balances[id].name,
                    paid: balances[id].paid,
                    owe: balances[id].owe,
                    net: balances[id].paid - balances[id].owe
                });
            });

            // 정산 트랜잭션 생성
            const debtors = netBalances.filter(b => b.net < 0).map(b => ({ ...b, remaining: Math.abs(b.net) }));
            const creditors = netBalances.filter(b => b.net > 0).map(b => ({ ...b, remaining: b.net }));
            const transactions = [];

            debtors.sort((a, b) => b.remaining - a.remaining);
            creditors.sort((a, b) => b.remaining - a.remaining);

            for (const debtor of debtors) {
                for (const creditor of creditors) {
                    if (debtor.remaining <= 0) break;
                    if (creditor.remaining <= 0) continue;
                    const amount = Math.min(debtor.remaining, creditor.remaining);
                    if (amount > 0) {
                        transactions.push({
                            from: debtor.name,
                            to: creditor.name,
                            amount: Math.round(amount)
                        });
                        debtor.remaining -= amount;
                        creditor.remaining -= amount;
                    }
                }
            }

            return { balances: netBalances, transactions };
        },

        // 멤버 관리
        addMember: (tripId, name, color) => {
            const trip = _data.trips.find(t => t.id === tripId);
            if (!trip) return null;
            const colors = ['#4F46E5', '#059669', '#DC2626', '#D97706', '#7C3AED', '#EC4899', '#0891B2', '#16A34A'];
            const member = {
                id: generateId(),
                name,
                color: color || colors[trip.members.length % colors.length],
                role: '멤버',
                avatar: name ? name[0] : '?'
            };
            trip.members.push(member);
            save(_data);
            return member;
        },
        removeMember: (tripId, memberId) => {
            const trip = _data.trips.find(t => t.id === tripId);
            if (!trip) return;
            trip.members = trip.members.filter(m => m.id !== memberId);
            save(_data);
        },
        updateMember: (tripId, memberId, updates) => {
            const trip = _data.trips.find(t => t.id === tripId);
            if (!trip) return;
            const member = trip.members.find(m => m.id === memberId);
            if (member) {
                Object.assign(member, updates);
                save(_data);
            }
        },

        // 체크리스트 관리
        addChecklistCategory: (tripId, name, icon) => {
            const trip = _data.trips.find(t => t.id === tripId);
            if (!trip) return null;
            const cat = createChecklistCategory(name, icon);
            trip.checklist.push(cat);
            save(_data);
            return cat;
        },
        removeChecklistCategory: (tripId, catId) => {
            const trip = _data.trips.find(t => t.id === tripId);
            if (!trip) return;
            trip.checklist = trip.checklist.filter(c => c.id !== catId);
            save(_data);
        },
        addChecklistItem: (tripId, catId, text, assignee) => {
            const trip = _data.trips.find(t => t.id === tripId);
            if (!trip) return null;
            const cat = trip.checklist.find(c => c.id === catId);
            if (!cat) return null;
            const item = createChecklistItem(text, assignee);
            cat.items.push(item);
            save(_data);
            return item;
        },
        toggleChecklistItem: (tripId, catId, itemId) => {
            const trip = _data.trips.find(t => t.id === tripId);
            if (!trip) return;
            const cat = trip.checklist.find(c => c.id === catId);
            if (!cat) return;
            const item = cat.items.find(i => i.id === itemId);
            if (item) {
                item.checked = !item.checked;
                save(_data);
            }
        },
        removeChecklistItem: (tripId, catId, itemId) => {
            const trip = _data.trips.find(t => t.id === tripId);
            if (!trip) return;
            const cat = trip.checklist.find(c => c.id === catId);
            if (!cat) return;
            cat.items = cat.items.filter(i => i.id !== itemId);
            save(_data);
        },
        getChecklistProgress: (tripId) => {
            const trip = _data.trips.find(t => t.id === tripId);
            if (!trip) return { total: 0, checked: 0, percent: 0 };
            let total = 0, checked = 0;
            trip.checklist.forEach(cat => {
                total += cat.items.length;
                checked += cat.items.filter(i => i.checked).length;
            });
            return { total, checked, percent: total > 0 ? Math.round((checked / total) * 100) : 0 };
        },

        // 메모 관리
        addJournal: (tripId, data) => {
            const trip = _data.trips.find(t => t.id === tripId);
            if (!trip) return null;
            const journal = createJournal(data);
            trip.journals.push(journal);
            save(_data);
            return journal;
        },
        updateJournal: (tripId, journalId, updates) => {
            const trip = _data.trips.find(t => t.id === tripId);
            if (!trip) return;
            const journal = trip.journals.find(j => j.id === journalId);
            if (journal) {
                Object.assign(journal, updates, { updatedAt: new Date().toISOString() });
                save(_data);
            }
        },
        removeJournal: (tripId, journalId) => {
            const trip = _data.trips.find(t => t.id === tripId);
            if (!trip) return;
            trip.journals = trip.journals.filter(j => j.id !== journalId);
            save(_data);
        },

        // 즐겨찾기
        toggleFavorite: (tripId, dayId, itemId) => {
            const trip = _data.trips.find(t => t.id === tripId);
            if (!trip) return;
            const day = trip.days.find(d => d.id === dayId);
            if (!day) return;
            const item = day.items.find(i => i.id === itemId);
            if (!item) return;
            item.isFavorite = !item.isFavorite;
            save(_data);
            return item.isFavorite;
        },
        getFavorites: (tripId) => {
            const trip = _data.trips.find(t => t.id === tripId);
            if (!trip) return [];
            const favs = [];
            trip.days.forEach(day => {
                day.items.forEach(item => {
                    if (item.isFavorite) {
                        favs.push({ ...item, dayId: day.id, dayNumber: day.dayNumber });
                    }
                });
            });
            return favs;
        },

        // 후보 장소
        addCandidate: (tripId, data) => {
            const trip = _data.trips.find(t => t.id === tripId);
            if (!trip) return null;
            if (!trip.candidates) trip.candidates = [];
            const candidate = {
                id: generateId(),
                title: data.title || '',
                category: data.category || 'place',
                address: data.address || '',
                lat: data.lat || null,
                lng: data.lng || null,
                imageUrl: data.imageUrl || '',
                notes: data.notes || '',
                placeId: data.placeId || '',
                rating: data.rating || null,
                createdAt: new Date().toISOString()
            };
            trip.candidates.push(candidate);
            save(_data);
            return candidate;
        },
        removeCandidate: (tripId, candidateId) => {
            const trip = _data.trips.find(t => t.id === tripId);
            if (!trip || !trip.candidates) return;
            trip.candidates = trip.candidates.filter(c => c.id !== candidateId);
            save(_data);
        },
        getCandidates: (tripId) => {
            const trip = _data.trips.find(t => t.id === tripId);
            if (!trip) return [];
            return trip.candidates || [];
        },

        // 현재 사용자
        getMyMemberId: () => _data.settings.myMemberId,
        setMyMemberId: (id) => {
            _data.settings.myMemberId = id;
            save(_data);
        },
        getCurrentMemberName: () => {
            const trip = _data.trips.find(t => t.id === _data.currentTripId);
            if (!trip || !_data.settings.myMemberId) return '알 수 없음';
            const m = trip.members.find(m => m.id === _data.settings.myMemberId);
            return m ? m.name : '알 수 없음';
        },

        // 활동 로그
        addActivity: (tripId, action, detail) => {
            const trip = _data.trips.find(t => t.id === tripId);
            if (!trip) return;
            if (!trip.activityLog) trip.activityLog = [];
            const name = _data.settings.myMemberId
                ? (trip.members.find(m => m.id === _data.settings.myMemberId)?.name || '알 수 없음')
                : '알 수 없음';
            trip.activityLog.unshift({
                id: generateId(),
                memberId: _data.settings.myMemberId || null,
                memberName: name,
                action,
                detail: detail || '',
                timestamp: new Date().toISOString()
            });
            // 최대 100개 유지
            if (trip.activityLog.length > 100) trip.activityLog.length = 100;
            save(_data);
        },
        getActivityLog: (tripId) => {
            const trip = _data.trips.find(t => t.id === tripId);
            return trip ? (trip.activityLog || []) : [];
        },

        // 유틸리티
        generateId,
        save: () => save(_data),
        // Firebase에서 원격 데이터 적용 (다른 사용자 변경)
        applyRemoteData: (remoteData) => {
            _data = { ...defaultData, ...remoteData };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(_data));
        },
        // Firebase 초기 데이터 로드 (로컬보다 원격 우선)
        loadRemoteData: (remoteData) => {
            _data = { ...defaultData, ...remoteData };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(_data));
        },
        reset: () => {
            _data = { ...defaultData };
            save(_data);
        }
    };
})();
