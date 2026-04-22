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
                // 멤버 미선택 시 선택 모달 표시
                checkMemberSelection();
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

        const pageIcons = {
            dashboard: 'dashboard',
            itinerary: 'calendar_month',
            reservations: 'confirmation_number',
            budget: 'account_balance_wallet',
            map: 'map',
            checklist: 'checklist',
            journal: 'edit_note',
            members: 'group',
            favorites: 'favorite',
            weather: 'cloud'
        };

        const helpTexts = {
            dashboard: '• 다가오는 일정, 예산, 준비물 현황을 한눈에 확인\n• 준비물 체크를 바로 토글 가능\n• D-Day 카운트다운 표시\n• 각 섹션 클릭 시 해당 페이지로 이동',
            itinerary: '• 일차별 일정을 추가/수정/삭제\n• Google Maps 장소 검색 또는 링크 붙여넣기로 자동 입력\n• 드래그 앤 드롭으로 일정 순서 변경\n• 후보 장소를 드래그하여 원하는 위치에 삽입\n• 시작/종료 시간 클릭으로 인라인 수정\n• 이동 수단별 소요 시간 자동 계산\n• "+" 버튼으로 원하는 위치에 일정 추가',
            reservations: '• 항공, 숙소, 식당, 교통 등 예약 정보 관리\n• 확정/대기/취소 상태 관리\n• 확정 예약은 지출 관리에 자동 반영\n• 유형별 필터로 빠르게 검색',
            budget: '• 지출 내역 기록 및 카테고리별 분석\n• "확정 예약 포함" 옵션으로 예약 비용 자동 반영\n• "예상 비용 포함" 옵션으로 일정 비용 자동 반영\n• 멤버별 정산 (누가 누구에게 얼마) 자동 계산\n• 총 예산 설정 및 진행률 표시',
            map: '• 전체 일정을 지도에 마커로 표시\n• 장소 검색 후 일정 또는 후보에 추가\n• 경로 보기로 이동 거리/시간 확인\n• 일차별 필터링\n• 후보 장소 관리 및 지도에서 바로 추가',
            checklist: '• 카테고리별 준비물/할 일 체크리스트\n• 담당자 배정 가능\n• "담당자별" 보기로 담당자 기준 분류\n• 프리셋으로 빠른 카테고리 추가\n• 진행률 자동 계산',
            journal: '• 여행 아이디어, 팁, 일기 등 자유롭게 기록\n• 태그로 분류\n• 작성 시간 자동 기록',
            members: '• 여행 멤버 추가/수정/삭제\n• 본인 선택 후 "나" 배지 표시\n• 멤버별 지출 현황 확인\n• 활동 로그로 변경 내역 추적',
            favorites: '• 일정에서 ♥ 표시한 장소를 모아보기\n• 이미지와 함께 카드형 표시',
            weather: '• 여행지 도시명으로 현재 날씨 확인\n• 5일 예보 제공\n• 체감온도, 습도, 풍속, 일출/일몰 정보'
        };

        const [title, subtitle] = titles[page] || ['', ''];
        document.getElementById('page-title').textContent = title;
        document.getElementById('page-subtitle').textContent = subtitle;

        // 페이지 아이콘
        const iconEl = document.getElementById('page-icon');
        if (iconEl) iconEl.textContent = pageIcons[page] || 'article';

        // 도움말 아이콘 — title-row 안에 배치
        const titleRow = document.querySelector('.page-title-row');
        let helpBtn = document.getElementById('page-help-btn');
        if (!helpBtn && titleRow) {
            helpBtn = document.createElement('button');
            helpBtn.id = 'page-help-btn';
            helpBtn.className = 'btn-icon page-help-btn';
            helpBtn.innerHTML = '<span class="material-symbols-rounded" style="font-size:1.1rem">help_outline</span>';
            titleRow.appendChild(helpBtn);
        }
        if (helpBtn) {
            const helpText = helpTexts[page] || '';
            helpBtn.setAttribute('data-help', helpText);
            helpBtn.onmouseenter = showPageHelp;
            helpBtn.onmouseleave = hidePageHelp;
            helpBtn.onclick = (e) => {
                const existing = document.getElementById('page-help-tooltip');
                if (existing) { existing.remove(); return; }
                showPageHelp.call(helpBtn, e);
            };
        }
    }

    function showPageHelp(e) {
        hidePageHelp();
        const text = this.getAttribute('data-help');
        if (!text) return;
        const tip = document.createElement('div');
        tip.id = 'page-help-tooltip';
        tip.className = 'page-help-tooltip';
        tip.innerHTML = text.split('\n').map(line => `<div>${UI.escapeHtml(line)}</div>`).join('');
        document.body.appendChild(tip);
        const rect = this.getBoundingClientRect();
        tip.style.top = (rect.bottom + 8) + 'px';
        tip.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - 320)) + 'px';
    }

    function hidePageHelp() {
        const tip = document.getElementById('page-help-tooltip');
        if (tip) tip.remove();
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
        let allItems = [];
        trip.checklist.forEach(cat => {
            cat.items.forEach(item => {
                allItems.push({ ...item, catId: cat.id });
            });
        });
        // 미완료 먼저, 완료 뒤에
        const unchecked = allItems.filter(i => !i.checked);
        const checked = allItems.filter(i => i.checked);
        const displayItems = [...unchecked, ...checked].slice(0, 6);

        container.innerHTML = `
            <div style="margin-bottom:10px;display:flex;align-items:center;gap:10px">
                <div style="flex:1;height:6px;background:var(--bg-tertiary);border-radius:3px;overflow:hidden">
                    <div style="width:${pct}%;height:100%;background:var(--primary);border-radius:3px"></div>
                </div>
                <span style="font-size:0.82rem;font-weight:600;color:var(--primary)">${pct}%</span>
            </div>
            ${displayItems.map(item => `
                <div style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:0.85rem;cursor:pointer;${item.checked ? 'opacity:0.45' : ''}" onclick="App.toggleDashChecklist('${item.catId}','${item.id}')">
                    <span style="color:${item.checked ? 'var(--success)' : 'var(--text-tertiary)'}">${item.checked ? '☑' : '☐'}</span>
                    <span style="flex:1;${item.checked ? 'text-decoration:line-through' : ''}">${UI.escapeHtml(item.text)}</span>
                    ${item.assignee ? `<span class="checklist-item-assignee" style="font-size:0.7rem">${UI.escapeHtml(item.assignee)}</span>` : ''}
                </div>
            `).join('')}
            ${allItems.length > 6 ? `<div style="font-size:0.78rem;color:var(--text-tertiary);margin-top:4px">외 ${allItems.length - 6}개</div>` : ''}
        `;
    }

    // ---- 멤버 선택 ----
    function checkMemberSelection() {
        const trip = Store.getCurrentTrip();
        if (!trip || trip.members.length === 0) return;
        const myId = Store.getMyMemberId();
        // 이미 선택했고 해당 멤버가 존재하면 스킵
        if (myId && trip.members.find(m => m.id === myId)) return;
        setTimeout(() => showMemberSelectModal(), 500);
    }

    function showMemberSelectModal() {
        const trip = Store.getCurrentTrip();
        if (!trip) return;

        const membersHTML = trip.members.map(m =>
            `<button class="member-select-option" data-mid="${m.id}" style="display:flex;align-items:center;gap:12px;padding:12px 16px;border:1px solid var(--border-light);border-radius:var(--radius-md);background:var(--bg-secondary);cursor:pointer;width:100%;transition:all var(--transition-fast)">
                <div style="width:36px;height:36px;border-radius:50%;background:${m.color};display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700">${UI.escapeHtml(m.avatar || m.name[0])}</div>
                <span style="font-weight:600">${UI.escapeHtml(m.name)}</span>
                <span style="font-size:0.8rem;color:var(--text-tertiary)">${UI.escapeHtml(m.role)}</span>
            </button>`
        ).join('');

        UI.showModal('본인을 선택하세요', `
            <p style="margin-bottom:16px;color:var(--text-secondary);font-size:0.88rem">여행 멤버 중 본인을 선택해주세요. 활동 내역이 기록됩니다.</p>
            <div style="display:flex;flex-direction:column;gap:8px">${membersHTML}</div>
            <div style="margin-top:12px;text-align:center">
                <button class="btn-text" id="btn-add-me-as-member" style="font-size:0.85rem;color:var(--primary)">
                    <span class="material-symbols-rounded" style="font-size:1rem;vertical-align:middle">person_add</span> 새 멤버로 참가하기
                </button>
            </div>
        `, '');

        setTimeout(() => {
            document.querySelectorAll('.member-select-option').forEach(btn => {
                btn.addEventListener('click', () => {
                    Store.setMyMemberId(btn.dataset.mid);
                    UI.closeModal();
                    const name = trip.members.find(m => m.id === btn.dataset.mid)?.name || '';
                    UI.showToast(`${name}님으로 설정되었습니다`, 'success');
                    renderCurrentPage();
                });
            });
            const addBtn = document.getElementById('btn-add-me-as-member');
            if (addBtn) {
                addBtn.onclick = () => {
                    UI.closeModal();
                    showAddMeModal();
                };
            }
        }, 50);
    }

    function showAddMeModal() {
        const trip = Store.getCurrentTrip();
        if (!trip) return;
        UI.showModal('새 멤버로 참가', `
            <div class="form-group">
                <label class="form-label">이름 *</label>
                <input type="text" id="new-me-name" placeholder="본인 이름" />
            </div>
        `, `
            <button class="btn-outline" onclick="UI.closeModal()">취소</button>
            <button class="btn-primary" id="btn-save-me">참가</button>
        `);
        setTimeout(() => {
            document.getElementById('btn-save-me').onclick = () => {
                const name = document.getElementById('new-me-name').value.trim();
                if (!name) { UI.showToast('이름을 입력해주세요', 'warning'); return; }
                const member = Store.addMember(trip.id, name);
                Store.setMyMemberId(member.id);
                UI.closeModal();
                UI.showToast(`${name}님으로 참가되었습니다!`, 'success');
                renderCurrentPage();
                updateDashboard();
            };
            document.getElementById('new-me-name').focus();
        }, 50);
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

                // 날짜 기반 일차 자동 생성
                const startDate = document.getElementById('new-trip-start').value;
                const endDate = document.getElementById('new-trip-end').value;
                if (startDate && endDate) {
                    const start = new Date(startDate);
                    const end = new Date(endDate);
                    const diffDays = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
                    for (let i = 0; i < diffDays && i < 30; i++) {
                        Store.addDay(trip.id);
                    }
                }

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

    function toggleDashChecklist(catId, itemId) {
        const trip = Store.getCurrentTrip();
        if (!trip) return;
        const cat = trip.checklist.find(c => c.id === catId);
        const item = cat?.items.find(i => i.id === itemId);
        Store.toggleChecklistItem(trip.id, catId, itemId);
        if (item) Store.addActivity(trip.id, '체크리스트', `"${item.text}" ${item.checked ? '완료' : '해제'}`);
        updateDashboard();
    }

    return {
        navigateTo,
        updateDashboard,
        setTheme,
        showNewTripModal,
        toggleDashChecklist
    };
})();
