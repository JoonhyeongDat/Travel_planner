/* ===================================
   트래블메이트 - 메인 앱 로직
   초기화, 라우팅, 이벤트 바인딩
   =================================== */

const App = (() => {
    let currentPage = 'dashboard';

    // ---- 초기화 ----
    function init() {
        // 스플래시 화면
        setTimeout(() => {
            const splash = document.getElementById('splash-screen');
            splash.classList.add('fade-out');
            setTimeout(() => {
                splash.style.display = 'none';
                document.getElementById('app').style.display = 'flex';
            }, 600);
        }, 1400);

        // Firebase 초기화 및 동기화
        initFirebase();

        // 저장된 테마 복원
        const settings = Store.getSettings();
        if (settings.theme) {
            setTheme(settings.theme);
        }

        // 여행 목록 로드
        loadTripList();

        // 현재 여행이 없으면 기본 여행 생성 여부 확인
        if (!Store.getCurrentTrip() && Store.getTrips().length === 0) {
            // 첫 사용자를 위한 샘플 여행 생성
            setTimeout(() => showNewTripModal(), 2200);
        } else {
            setTimeout(() => {
                updateDashboard();
                renderCurrentPage();
            }, 100);
        }

        // 이벤트 바인딩
        bindEvents();
    }

    // ---- Firebase 초기화 ----
    function initFirebase() {
        if (typeof FirebaseSync === 'undefined') return;

        const ok = FirebaseSync.init();
        if (!ok) return;

        // 서버에서 초기 데이터 가져오기 (완료 전까지 push 차단)
        FirebaseSync.pullData().then(remoteData => {
            if (remoteData && remoteData.trips && remoteData.trips.length > 0) {
                // 원격 데이터가 있으면 로컬 데이터와 병합
                const localData = Store.getData();
                const localHasData = localData.trips && localData.trips.length > 0;

                if (localHasData) {
                    const mergedTrips = [...remoteData.trips];
                    localData.trips.forEach(lt => {
                        if (!mergedTrips.find(rt => rt.id === lt.id)) {
                            mergedTrips.push(lt);
                        }
                    });
                    remoteData.trips = mergedTrips;
                }

                Store.loadRemoteData(remoteData);
                loadTripList();
                updateDashboard();
                renderCurrentPage();
            }

            // pullData 완료 → 이제 push 허용
            FirebaseSync.setReady(true);
            // 로컬 데이터를 Firebase에 동기화 (병합 결과 반영)
            Store.save();

            // 실시간 리스너 시작 (pullData 완료 후)
            FirebaseSync.startListening((newData) => {
                const prevTripId = Store.getData().currentTripId;
                Store.applyRemoteData(newData);
                // 현재 선택된 여행 유지 (Firebase push 없이)
                if (prevTripId) {
                    const stillExists = Store.getTrips().find(t => t.id === prevTripId);
                    if (stillExists) {
                        Store.getData().currentTripId = prevTripId;
                    }
                }
                loadTripList();
                updateDashboard();
                renderCurrentPage();
                console.log('[Sync] 다른 사용자의 변경사항 반영 완료');
            });
        }).catch(err => {
            console.error('[Firebase] 초기 데이터 로드 실패:', err);
            FirebaseSync.setReady(true);
            // 오프라인에서도 정상 동작
            FirebaseSync.startListening((newData) => {
                Store.applyRemoteData(newData);
                loadTripList();
                updateDashboard();
                renderCurrentPage();
            });
        });
    }

    // ---- 이벤트 바인딩 ----
    function bindEvents() {
        // 사이드바 네비게이션
        document.getElementById('nav-menu').addEventListener('click', (e) => {
            const item = e.target.closest('.nav-item');
            if (item) navigateTo(item.dataset.page);
        });

        // 모바일 네비게이션
        document.getElementById('mobile-nav').addEventListener('click', (e) => {
            const item = e.target.closest('.mobile-nav-item');
            if (!item) return;
            const page = item.dataset.page;
            if (page === 'more') {
                toggleMoreMenu(true);
            } else {
                navigateTo(page);
            }
        });

        // 더보기 메뉴
        document.getElementById('more-menu').addEventListener('click', (e) => {
            const item = e.target.closest('.more-menu-item');
            if (item) {
                navigateTo(item.dataset.page);
                toggleMoreMenu(false);
            }
        });
        document.getElementById('more-menu-close').addEventListener('click', () => toggleMoreMenu(false));

        // 사이드바 토글
        document.getElementById('sidebar-toggle').addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('collapsed');
        });

        // 모바일 메뉴
        document.getElementById('mobile-menu-btn').addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('mobile-open');
        });

        // 사이드바 외부 클릭 시 닫기 (모바일)
        document.addEventListener('click', (e) => {
            const sidebar = document.getElementById('sidebar');
            if (sidebar.classList.contains('mobile-open') &&
                !sidebar.contains(e.target) &&
                !e.target.closest('#mobile-menu-btn')) {
                sidebar.classList.remove('mobile-open');
            }
        });

        // 테마 변경
        document.getElementById('theme-grid').addEventListener('click', (e) => {
            const btn = e.target.closest('.theme-btn');
            if (btn) setTheme(btn.dataset.theme);
        });

        // 여행 선택
        document.getElementById('trip-select').addEventListener('change', (e) => {
            if (e.target.value) {
                Store.setCurrentTrip(e.target.value);
                updateDashboard();
                renderCurrentPage();
            }
        });

        // 새 여행
        document.getElementById('btn-new-trip').addEventListener('click', showNewTripModal);

        // 여행 삭제
        document.getElementById('btn-delete-trip').addEventListener('click', () => {
            const trip = Store.getCurrentTrip();
            if (!trip) {
                UI.showToast('삭제할 여행이 없습니다', 'warning');
                return;
            }
            UI.showConfirm(`"${trip.name}" 여행을 삭제하시겠습니까?\n모든 일정, 예약, 후보가 함께 삭제됩니다.`, () => {
                Store.deleteTrip(trip.id);
                loadTripList();
                updateDashboard();
                renderCurrentPage();
                UI.showToast('여행이 삭제되었습니다', 'success');
            });
        });

        // 일정 페이지 버튼
        document.getElementById('btn-add-day').addEventListener('click', () => Itinerary.addDay());
        Itinerary.initCandidatesPanel();

        // 일정 뷰 전환
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const view = btn.dataset.view;
                const content = document.getElementById('itinerary-content');
                content.classList.remove('view-day', 'view-list', 'view-timeline');
                if (view !== 'day') content.classList.add('view-' + view);
            });
        });

        // 예약 관리
        document.getElementById('btn-add-reservation').addEventListener('click', () => Reservations.showAddModal());
        document.querySelectorAll('.reservation-tabs .tab-btn').forEach(btn => {
            btn.addEventListener('click', () => Reservations.setFilter(btn.dataset.tab));
        });

        // 예산 관리
        document.getElementById('btn-add-expense').addEventListener('click', () => Budget.showAddModal());
        document.getElementById('btn-edit-budget').addEventListener('click', () => Budget.showEditBudgetModal());
        document.querySelectorAll('[data-budget-tab]').forEach(btn => {
            btn.addEventListener('click', () => Budget.setTab(btn.dataset.budgetTab));
        });

        // 체크리스트
        document.getElementById('btn-add-category').addEventListener('click', () => Checklist.showAddCategoryModal());
        document.getElementById('btn-add-checklist-item').addEventListener('click', () => {
            const trip = Store.getCurrentTrip();
            if (!trip || trip.checklist.length === 0) {
                Checklist.showAddCategoryModal();
            } else {
                Checklist.showAddItemModal(trip.checklist[0].id);
            }
        });

        // 메모
        document.getElementById('btn-add-journal').addEventListener('click', () => Journal.showAddModal());

        // 멤버
        document.getElementById('btn-add-member').addEventListener('click', () => Members.showAddModal());

        // 날씨
        document.getElementById('btn-search-weather').addEventListener('click', () => Weather.search());
        document.getElementById('weather-city').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') Weather.search();
        });

        // 지도
        document.getElementById('btn-show-route').addEventListener('click', () => MapView.showRoute());
        document.getElementById('map-day-filter').addEventListener('change', (e) => MapView.setFilter(e.target.value));
        document.getElementById('btn-map-search').addEventListener('click', () => {
            const q = document.getElementById('map-search-input').value.trim();
            if (q) MapView.searchPlace(q);
            document.getElementById('map-search-input').blur();
        });
        document.querySelectorAll('.map-tab').forEach(btn => {
            btn.addEventListener('click', () => MapView.switchTab(btn.dataset.mapTab));
        });

        // 전역 검색
        document.getElementById('global-search').addEventListener('input', debounce(handleSearch, 300));

        // 키보드 단축키
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                UI.closeModal();
                toggleMoreMenu(false);
            }
        });
    }

    // ---- 라우팅 ----
    function navigateTo(page) {
        if (!page || page === currentPage) return;
        currentPage = page;

        // 페이지 활성화
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        const pageEl = document.getElementById(`page-${page}`);
        if (pageEl) pageEl.classList.add('active');

        // 네비게이션 활성화
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        const navItem = document.querySelector(`.nav-item[data-page="${page}"]`);
        if (navItem) navItem.classList.add('active');

        // 모바일 네비게이션 활성화
        document.querySelectorAll('.mobile-nav-item').forEach(n => n.classList.remove('active'));
        const mobileNavItem = document.querySelector(`.mobile-nav-item[data-page="${page}"]`);
        if (mobileNavItem) mobileNavItem.classList.add('active');

        // 모바일 사이드바 닫기
        document.getElementById('sidebar').classList.remove('mobile-open');

        // 헤더 업데이트
        updateHeader(page);

        // 페이지 렌더링
        renderPage(page);
    }

    function updateHeader(page) {
        const titles = {
            dashboard: ['대시보드', '여행의 모든 것을 한눈에'],
            itinerary: ['일정표', '일별 여행 일정을 관리하세요'],
            reservations: ['예약 관리', '항공, 숙소, 티켓 등 예약 정보'],
            budget: ['예산 / 정산', '여행 경비를 기록하고 정산하세요'],
            map: ['지도', '여행지를 지도에서 확인하세요'],
            checklist: ['체크리스트', '준비물과 할 일을 관리하세요'],
            journal: ['여행 메모', '아이디어, 팁, 일기를 기록하세요'],
            members: ['멤버', '함께 여행하는 친구들'],
            favorites: ['즐겨찾기', '마음에 드는 장소 모음'],
            weather: ['날씨', '여행지 날씨 확인']
        };

        const [title, subtitle] = titles[page] || ['', ''];
        document.getElementById('page-title').textContent = title;
        document.getElementById('page-subtitle').textContent = subtitle;
    }

    function renderPage(page) {
        switch (page) {
            case 'dashboard': updateDashboard(); break;
            case 'itinerary': Itinerary.render(); break;
            case 'reservations': Reservations.render(); break;
            case 'budget': Budget.render(); break;
            case 'map': MapView.render(); break;
            case 'checklist': Checklist.render(); break;
            case 'journal': Journal.render(); break;
            case 'members': Members.render(); break;
            case 'favorites': Favorites.render(); break;
            case 'weather': Weather.render(); break;
        }
    }

    function renderCurrentPage() {
        renderPage(currentPage);
    }

    // ---- 대시보드 업데이트 ----
    function updateDashboard() {
        const trip = Store.getCurrentTrip();
        if (!trip) {
            document.getElementById('dash-trip-name').textContent = '새로운 여행을 시작하세요';
            document.getElementById('dash-trip-dates').textContent = '여행을 만들어보세요';
            document.getElementById('trip-badge').textContent = '✈️';
            return;
        }

        // 여행 요약
        document.getElementById('dash-trip-name').textContent = trip.name;
        document.getElementById('dash-trip-dest').textContent = trip.destination || '';

        if (trip.startDate && trip.endDate) {
            document.getElementById('dash-trip-dates').textContent =
                `${UI.formatDate(trip.startDate)} ~ ${UI.formatDate(trip.endDate)}`;
        } else {
            document.getElementById('dash-trip-dates').textContent = '날짜를 설정해주세요';
        }

        // D-Day
        const daysLeft = UI.daysUntil(trip.startDate);
        if (daysLeft !== null) {
            if (daysLeft > 0) {
                document.getElementById('trip-badge').textContent = `D-${daysLeft}`;
            } else if (daysLeft === 0) {
                document.getElementById('trip-badge').textContent = 'D-Day!';
            } else {
                document.getElementById('trip-badge').textContent = `D+${Math.abs(daysLeft)}`;
            }
        }

        // 히어로 이미지
        const hero = document.getElementById('trip-hero');
        if (trip.coverImage) {
            hero.style.backgroundImage = `url('${trip.coverImage}')`;
            hero.style.backgroundSize = 'cover';
            hero.style.backgroundPosition = 'center';
        }

        // 통계
        let totalItems = 0;
        trip.days.forEach(d => totalItems += d.items.length);
        document.getElementById('stat-days').textContent = totalItems;

        const totalSpent = Store.getTotalExpenses(trip.id);
        document.getElementById('stat-budget').textContent = UI.formatCurrency(trip.totalBudget || totalSpent);
        document.getElementById('stat-members').textContent = trip.members.length;

        const progress = Store.getChecklistProgress(trip.id);
        document.getElementById('stat-checklist').textContent = progress.percent + '%';

        // 다가오는 일정
        renderUpcoming(trip);

        // 예산 요약
        renderBudgetMini(trip);

        // 최근 메모
        renderNotesMini(trip);

        // 체크리스트 미니
        renderChecklistMini(trip);
    }

    function renderUpcoming(trip) {
        const container = document.getElementById('dash-upcoming');
        const items = [];
        trip.days.forEach(day => {
            day.items.forEach(item => {
                items.push({ ...item, dayNumber: day.dayNumber, date: day.date });
            });
        });

        if (items.length === 0) {
            container.innerHTML = `<div class="empty-state-sm"><span class="material-symbols-rounded">event_available</span><p>등록된 일정이 없습니다</p></div>`;
            return;
        }

        const upcoming = items.slice(0, 5);
        container.innerHTML = upcoming.map(item => `
            <div class="upcoming-item">
                <span class="upcoming-time">${item.startTime || `Day ${item.dayNumber}`}</span>
                <div>
                    <div class="upcoming-title">${UI.escapeHtml(item.title)}</div>
                    <div class="upcoming-category">${(UI.categoryInfo[item.category] || UI.categoryInfo.place).icon} ${(UI.categoryInfo[item.category] || UI.categoryInfo.place).label}</div>
                </div>
            </div>
        `).join('');
    }

    function renderBudgetMini(trip) {
        const container = document.getElementById('dash-budget-summary');
        const totalSpent = Store.getTotalExpenses(trip.id);
        const budget = trip.totalBudget || 0;

        if (totalSpent === 0 && budget === 0) {
            container.innerHTML = `<div class="empty-state-sm"><span class="material-symbols-rounded">savings</span><p>예산을 설정해주세요</p></div>`;
            return;
        }

        const pct = budget > 0 ? Math.min((totalSpent / budget) * 100, 100) : 0;
        const cats = Store.getExpensesByCategory(trip.id);
        const colors = ['#4F46E5', '#059669', '#D97706', '#DC2626', '#EC4899', '#0891B2'];

        const catBadges = Object.entries(cats).slice(0, 4).map(([key, val], i) => {
            const info = UI.expenseCategoryInfo[key] || UI.expenseCategoryInfo.etc;
            return `<div class="budget-mini-cat"><span class="budget-mini-dot" style="background:${colors[i]}"></span>${info.icon} ${UI.formatCurrency(val)}</div>`;
        }).join('');

        container.innerHTML = `
            <div style="margin-bottom:8px;font-size:0.9rem">
                <strong>${UI.formatCurrency(totalSpent)}</strong> / ${UI.formatCurrency(budget)}
            </div>
            <div class="budget-mini-bar"><div class="budget-mini-bar-fill" style="width:${pct}%"></div></div>
            <div class="budget-mini-categories">${catBadges}</div>
        `;
    }

    function renderNotesMini(trip) {
        const container = document.getElementById('dash-notes');
        if (trip.journals.length === 0) {
            container.innerHTML = `<div class="empty-state-sm"><span class="material-symbols-rounded">edit_note</span><p>메모를 작성해보세요</p></div>`;
            return;
        }

        const recent = [...trip.journals].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 3);
        container.innerHTML = recent.map(j => `
            <div style="padding:8px 0;border-bottom:1px solid var(--border-light);cursor:pointer" onclick="App.navigateTo('journal')">
                <div style="font-weight:600;font-size:0.88rem">${UI.escapeHtml(j.title)}</div>
                <div style="font-size:0.78rem;color:var(--text-tertiary)">${UI.timeAgo(j.updatedAt)}</div>
            </div>
        `).join('');
    }

    function renderChecklistMini(trip) {
        const container = document.getElementById('dash-checklist');
        const progress = Store.getChecklistProgress(trip.id);

        if (progress.total === 0) {
            container.innerHTML = `<div class="empty-state-sm"><span class="material-symbols-rounded">playlist_add_check</span><p>준비물을 추가해보세요</p></div>`;
            return;
        }

        const pct = progress.percent;
        let unchecked = [];
        trip.checklist.forEach(cat => {
            cat.items.forEach(item => {
                if (!item.checked) unchecked.push(item);
            });
        });

        container.innerHTML = `
            <div style="margin-bottom:10px;display:flex;align-items:center;gap:10px">
                <div style="flex:1;height:6px;background:var(--bg-tertiary);border-radius:3px;overflow:hidden">
                    <div style="width:${pct}%;height:100%;background:var(--primary);border-radius:3px"></div>
                </div>
                <span style="font-size:0.82rem;font-weight:600;color:var(--primary)">${pct}%</span>
            </div>
            ${unchecked.slice(0, 4).map(item => `
                <div style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:0.85rem">
                    <span style="color:var(--text-tertiary)">☐</span>
                    <span>${UI.escapeHtml(item.text)}</span>
                </div>
            `).join('')}
            ${unchecked.length > 4 ? `<div style="font-size:0.78rem;color:var(--text-tertiary);margin-top:4px">외 ${unchecked.length - 4}개</div>` : ''}
        `;
    }

    // ---- 여행 관리 ----
    function loadTripList() {
        const select = document.getElementById('trip-select');
        const trips = Store.getTrips();
        const currentTrip = Store.getCurrentTrip();

        select.innerHTML = '<option value="">여행을 선택하세요</option>' +
            trips.map(t => `<option value="${t.id}" ${currentTrip && currentTrip.id === t.id ? 'selected' : ''}>${t.name}</option>`).join('');
    }

    function showNewTripModal() {
        const themeButtons = [
            { key: 'city', icon: '🏙️', label: '도시' },
            { key: 'beach', icon: '🏖️', label: '해변' },
            { key: 'nature', icon: '🏔️', label: '자연' },
            { key: 'europe', icon: '🏰', label: '유럽' },
            { key: 'japan', icon: '⛩️', label: '일본' },
            { key: 'luxury', icon: '💎', label: '럭셔리' },
            { key: 'backpacking', icon: '🎒', label: '배낭' },
            { key: 'tropical', icon: '🌺', label: '열대' }
        ];

        const themeBtns = themeButtons.map(t =>
            `<label class="form-checkbox-label" style="cursor:pointer">
                <input type="radio" name="trip-theme" value="${t.key}" ${t.key === 'city' ? 'checked' : ''} style="display:none" />
                <span>${t.icon} ${t.label}</span>
            </label>`
        ).join('');

        UI.showModal('새 여행 만들기', `
            <div class="form-group">
                <label class="form-label">여행 이름 *</label>
                <input type="text" id="new-trip-name" placeholder="예: 도쿄 여행 2026" />
            </div>
            <div class="form-group">
                <label class="form-label">여행지</label>
                <input type="text" id="new-trip-dest" placeholder="예: 도쿄, 오사카" />
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">출발일</label>
                    <input type="date" id="new-trip-start" />
                </div>
                <div class="form-group">
                    <label class="form-label">도착일</label>
                    <input type="date" id="new-trip-end" />
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">여행 테마</label>
                <div class="form-checkbox-group">${themeBtns}</div>
            </div>
        `, `
            <button class="btn-outline" onclick="UI.closeModal()">취소</button>
            <button class="btn-primary" id="btn-create-trip">여행 만들기</button>
        `);

        setTimeout(() => {
            document.getElementById('btn-create-trip').onclick = () => {
                const name = document.getElementById('new-trip-name').value.trim();
                if (!name) {
                    UI.showToast('여행 이름을 입력해주세요', 'warning');
                    return;
                }

                const themeRadio = document.querySelector('input[name="trip-theme"]:checked');
                const theme = themeRadio ? themeRadio.value : 'city';

                const trip = Store.addTrip(
                    name,
                    document.getElementById('new-trip-dest').value.trim(),
                    document.getElementById('new-trip-start').value,
                    document.getElementById('new-trip-end').value,
                    theme
                );

                // 테마 적용
                setTheme(theme);

                UI.closeModal();
                loadTripList();
                updateDashboard();
                renderCurrentPage();
                UI.showToast(`"${name}" 여행이 생성되었습니다!`, 'success');
            };
            document.getElementById('new-trip-name').focus();
        }, 50);
    }

    // ---- 테마 ----
    function setTheme(theme) {
        document.body.setAttribute('data-theme', theme);
        Store.updateSettings({ theme });

        document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.theme === theme);
        });
    }

    // ---- 더보기 메뉴 (모바일) ----
    function toggleMoreMenu(show) {
        document.getElementById('more-menu').style.display = show ? 'flex' : 'none';
    }

    // ---- 검색 ----
    function handleSearch(e) {
        const query = e.target.value.toLowerCase().trim();
        if (!query) return;

        const trip = Store.getCurrentTrip();
        if (!trip) return;

        // 일정에서 검색
        let found = false;
        trip.days.forEach(day => {
            day.items.forEach(item => {
                if (item.title.toLowerCase().includes(query) ||
                    item.address.toLowerCase().includes(query) ||
                    item.notes.toLowerCase().includes(query)) {
                    if (!found) {
                        navigateTo('itinerary');
                        found = true;
                        UI.showToast(`"${query}" 검색 결과가 일정에서 발견되었습니다`, 'info');
                    }
                }
            });
        });

        if (!found) {
            // 메모에서 검색
            trip.journals.forEach(j => {
                if (j.title.toLowerCase().includes(query) || j.content.toLowerCase().includes(query)) {
                    if (!found) {
                        navigateTo('journal');
                        found = true;
                        UI.showToast(`"${query}" 검색 결과가 메모에서 발견되었습니다`, 'info');
                    }
                }
            });
        }

        if (!found) {
            UI.showToast(`"${query}" 검색 결과가 없습니다`, 'info');
        }
    }

    // ---- 유틸리티 ----
    function debounce(fn, delay) {
        let timer;
        return function (...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), delay);
        };
    }

    // ---- 시작 ----
    document.addEventListener('DOMContentLoaded', init);

    return {
        navigateTo,
        updateDashboard,
        setTheme,
        showNewTripModal
    };
})();
