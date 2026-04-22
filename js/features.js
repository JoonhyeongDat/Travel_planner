/* ===================================
   트래블메이트 - 기능 모듈
   일정, 예약, 예산, 체크리스트, 메모, 멤버, 지도, 날씨
   =================================== */

// ========== 일정표 ==========
const Itinerary = (() => {
    function render() {
        const trip = Store.getCurrentTrip();
        const container = document.getElementById('itinerary-content');
        if (!trip || trip.days.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🗓️</div>
                    <h3>아직 일정이 없습니다</h3>
                    <p>첫 번째 여행 일차를 추가해보세요!</p>
                    <button class="btn-primary" onclick="Itinerary.addDay()">
                        <span class="material-symbols-rounded">add</span> 일차 추가하기
                    </button>
                </div>`;
            renderItineraryCandidates();
            return;
        }

        container.innerHTML = trip.days.map(day => renderDay(day, trip)).join('');
        UI.initDragAndDrop(container);

        // 후보 사이드바에도 드래그 앤 드롭 초기화
        const sidebar = document.querySelector('.itinerary-candidates-sidebar');
        if (sidebar && !sidebar._dndInit) {
            UI.initDragAndDrop(sidebar);
            sidebar._dndInit = true;
        }

        renderItineraryCandidates();
    }

    function renderDay(day, trip) {
        const dateStr = day.date ? UI.formatDate(day.date) : '';
        let itemsHTML = '';
        if (day.items.length > 0) {
            // 맨 앞에 + 버튼
            itemsHTML += `<div class="item-insert-zone" onclick="Itinerary.showAddItemModal('${day.id}',0)">
                <button class="item-insert-btn" title="여기에 일정 추가"><span class="material-symbols-rounded">add</span></button>
            </div>`;
            day.items.forEach((item, idx) => {
                itemsHTML += renderItem(item, day.id);
                const next = day.items[idx + 1];
                if (next) {
                    itemsHTML += renderTravelConnector(item, next, day.id);
                }
                // 각 아이템 뒤에 + 버튼
                itemsHTML += `<div class="item-insert-zone" onclick="Itinerary.showAddItemModal('${day.id}',${idx + 1})">
                    <button class="item-insert-btn" title="여기에 일정 추가"><span class="material-symbols-rounded">add</span></button>
                </div>`;
            });
        } else {
            itemsHTML = `<div class="empty-state-sm"><p>일정을 추가해보세요</p></div>`;
        }

        return `
            <div class="day-card" data-day-id="${day.id}">
                <div class="day-header" draggable="false">
                    <div class="day-header-left">
                        <span class="day-number">Day ${day.dayNumber}</span>
                        <span class="day-date">${dateStr}</span>
                    </div>
                    <div class="day-header-right">
                        <button class="btn-icon" onclick="Itinerary.showAddItemModal('${day.id}')" title="일정 추가">
                            <span class="material-symbols-rounded">add</span>
                        </button>
                        <button class="btn-icon" onclick="Itinerary.removeDay('${day.id}')" title="일차 삭제">
                            <span class="material-symbols-rounded">delete_outline</span>
                        </button>
                    </div>
                </div>
                <div class="day-items" data-day-id="${day.id}">
                    ${itemsHTML}
                </div>
            </div>`;
    }

    function renderItem(item, dayId) {
        const catInfo = UI.categoryInfo[item.category] || UI.categoryInfo.place;
        const imageHTML = item.imageUrl
            ? `<div class="item-image"><img src="${UI.escapeHtml(item.imageUrl)}" alt="${UI.escapeHtml(item.title)}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'item-image-placeholder\\'>${catInfo.icon}</div>'"/></div>`
            : `<div class="item-image"><div class="item-image-placeholder">${catInfo.icon}</div></div>`;

        const commentsHTML = item.comments.length > 0
            ? `<div class="item-comments">
                ${item.comments.map(c => `
                    <div class="comment">
                        <div class="comment-avatar">${UI.escapeHtml(c.author[0])}</div>
                        <div>
                            <div class="comment-text">${UI.escapeHtml(c.text)}</div>
                            <div class="comment-meta">${c.author} · ${UI.timeAgo(c.createdAt)}</div>
                        </div>
                    </div>
                `).join('')}
               </div>`
            : '';

        return `
            <div class="itinerary-item" data-item-id="${item.id}" draggable="true">
                <div class="item-drag-handle">
                    <span class="material-symbols-rounded">drag_indicator</span>
                </div>
                <div class="item-time">
                    <span class="item-time-start" onclick="Itinerary.editTimeInline(event,'${dayId}','${item.id}','start')">${item.startTime || '--:--'}</span>
                    <div class="item-time-divider"></div>
                    <span class="item-time-end" onclick="Itinerary.editTimeInline(event,'${dayId}','${item.id}','end')">${item.endTime || '--:--'}</span>
                </div>
                ${imageHTML}
                <div class="item-content">
                    <div class="item-title">
                        ${UI.escapeHtml(item.title)}
                        <span class="item-category-badge" style="background:${catInfo.color}15;color:${catInfo.color}">${catInfo.label}</span>
                        ${item.isFavorite ? '<span style="color:#EC4899">♥</span>' : ''}
                    </div>
                    ${item.address ? `<div class="item-address"><span class="material-symbols-rounded" style="font-size:0.9rem">location_on</span> ${UI.escapeHtml(item.address)}</div>` : ''}
                    ${item.notes ? `<div class="item-notes">${UI.escapeHtml(item.notes)}</div>` : ''}
                    ${item.cost ? `<div class="item-travel-info"><span class="material-symbols-rounded">payments</span> ${UI.formatCurrency(item.cost)}</div>` : ''}
                    ${commentsHTML}
                    <div class="comment-input">
                        <input type="text" placeholder="댓글 추가..." onkeydown="if(event.key==='Enter')Itinerary.addComment('${dayId}','${item.id}',this.value,this)" />
                    </div>
                </div>
                <div class="item-actions">
                    <button class="btn-icon btn-sm" onclick="Itinerary.showEditItemModal('${dayId}','${item.id}')" title="수정">
                        <span class="material-symbols-rounded">edit</span>
                    </button>
                    <button class="btn-icon btn-sm" onclick="Itinerary.toggleFavorite('${dayId}','${item.id}')" title="즐겨찾기">
                        <span class="material-symbols-rounded">${item.isFavorite ? 'favorite' : 'favorite_border'}</span>
                    </button>
                    <button class="btn-icon btn-sm" onclick="Itinerary.moveItemToCandidate('${dayId}','${item.id}')" title="후보로 이동">
                        <span class="material-symbols-rounded">bookmark_remove</span>
                    </button>
                    <button class="btn-icon btn-sm" onclick="Itinerary.removeItem('${dayId}','${item.id}')" title="삭제">
                        <span class="material-symbols-rounded">delete_outline</span>
                    </button>
                </div>
            </div>`;
    }

    // ===== 이동 시간 커넥터 =====
    function renderTravelConnector(fromItem, toItem, dayId) {
        const info = fromItem.travelInfo;
        const pairKey = `${fromItem.id}_${toItem.id}`;
        const hasCoords = fromItem.lat && fromItem.lng && toItem.lat && toItem.lng;

        if (!info && hasCoords) {
            // 아직 데이터 없으면 로딩 표시 + 자동 계산 트리거
            setTimeout(() => fetchTravelTimes(fromItem, toItem, dayId), 100);
            return `<div class="travel-connector travel-connector-loading" data-pair="${pairKey}">
                <div class="travel-connector-line"></div>
                <div class="travel-modes">
                    <span class="travel-loading-text">이동 시간 계산 중...</span>
                </div>
                <button class="travel-edit-btn" style="opacity:1" onclick="Itinerary.editTravelTime('${dayId}','${fromItem.id}')" title="직접 입력">
                    <span class="material-symbols-rounded">edit</span>
                </button>
            </div>`;
        }

        if (!info) {
            return `<div class="travel-connector travel-connector-empty" data-pair="${pairKey}">
                <div class="travel-connector-line"></div>
                <div class="travel-modes">
                    <span class="travel-no-data"><span class="material-symbols-rounded">more_vert</span></span>
                </div>
            </div>`;
        }

        // 경로 탐색 결과 없음
        if (info.noRoute) {
            return `<div class="travel-connector travel-connector-no-route" data-pair="${pairKey}">
                <div class="travel-connector-line"></div>
                <div class="travel-modes">
                    <span class="travel-no-route-text">경로 탐색 결과 없음</span>
                </div>
                <button class="travel-edit-btn" style="opacity:1" onclick="Itinerary.editTravelTime('${dayId}','${fromItem.id}')" title="이동 시간 직접 입력">
                    <span class="material-symbols-rounded">edit</span>
                </button>
            </div>`;
        }

        const modes = [
            { key: 'walking', icon: 'directions_walk', label: '도보' },
            { key: 'driving', icon: 'directions_car', label: '차량' },
            { key: 'transit', icon: 'directions_transit', label: '대중교통' }
        ];

        const selectedMode = info.selectedMode || '';

        const modesHTML = modes.map(m => {
            const data = info[m.key];
            if (!data) return '';
            const isSelected = selectedMode === m.key;
            return `<button class="travel-mode-btn ${isSelected ? 'selected' : ''}" 
                data-mode="${m.key}" data-from="${fromItem.id}" data-day="${dayId}"
                onclick="Itinerary.selectTravelMode('${dayId}','${fromItem.id}','${m.key}')"
                title="${m.label}: ${data.duration} (${data.distance})">
                <span class="material-symbols-rounded">${m.icon}</span>
                <span class="travel-mode-time">${data.duration}</span>
            </button>`;
        }).join('');

        return `<div class="travel-connector" data-pair="${pairKey}">
            <div class="travel-connector-line"></div>
            <div class="travel-modes">${modesHTML}</div>
            <button class="travel-edit-btn" onclick="Itinerary.editTravelTime('${dayId}','${fromItem.id}')" title="이동 시간 직접 수정">
                <span class="material-symbols-rounded">edit</span>
            </button>
        </div>`;
    }

    // Directions API로 이동 시간 조회
    const _fetchedPairs = new Set();
    function fetchTravelTimes(fromItem, toItem, dayId) {
        const pairKey = `${fromItem.id}_${toItem.id}`;
        if (_fetchedPairs.has(pairKey)) return;
        _fetchedPairs.add(pairKey);

        if (typeof google === 'undefined' || !google.maps) {
            // Google Maps 미로드 시 noRoute 처리
            saveTravelResults({}, dayId, fromItem.id);
            return;
        }

        const service = new google.maps.DirectionsService();
        const origin = { lat: fromItem.lat, lng: fromItem.lng };
        const dest = { lat: toItem.lat, lng: toItem.lng };
        const results = {};
        let done = 0;
        const total = 3;
        let saved = false;

        function checkDone() {
            if (saved) return;
            done++;
            if (done === total) {
                saved = true;
                saveTravelResults(results, dayId, fromItem.id);
            }
        }

        // 10초 타임아웃: API 응답 없으면 강제 noRoute
        setTimeout(() => {
            if (!saved) {
                saved = true;
                console.warn('[TravelTime] 타임아웃 - 경로 탐색 실패:', pairKey);
                saveTravelResults(results, dayId, fromItem.id);
            }
        }, 10000);

        // WALKING & DRIVING
        ['WALKING', 'DRIVING'].forEach(mode => {
            try {
                service.route({
                    origin, destination: dest,
                    travelMode: google.maps.TravelMode[mode]
                }, (res, status) => {
                    if (status === 'OK' && res && res.routes && res.routes[0]) {
                        const leg = res.routes[0].legs[0];
                        results[mode.toLowerCase()] = {
                            duration: leg.duration.text,
                            durationValue: leg.duration.value,
                            distance: leg.distance.text
                        };
                    }
                    checkDone();
                });
            } catch (e) {
                console.warn('[TravelTime]', mode, '오류:', e);
                checkDone();
            }
        });

        // TRANSIT
        try {
            service.route({
                origin, destination: dest,
                travelMode: google.maps.TravelMode.TRANSIT,
                transitOptions: { departureTime: new Date() }
            }, (res, status) => {
                if (status === 'OK' && res && res.routes && res.routes[0]) {
                    const leg = res.routes[0].legs[0];
                    results.transit = {
                        duration: leg.duration.text,
                        durationValue: leg.duration.value,
                        distance: leg.distance.text
                    };
                }
                checkDone();
            });
        } catch (e) {
            console.warn('[TravelTime] TRANSIT 오류:', e);
            checkDone();
        }
    }

    function saveTravelResults(results, dayId, itemId) {
        const trip = Store.getCurrentTrip();
        if (!trip) return;
        if (Object.keys(results).length === 0) {
            // 모든 경로 탐색 실패 → noRoute 마커 저장
            Store.updateItineraryItem(trip.id, dayId, itemId, {
                travelInfo: { noRoute: true, selectedMode: '' }
            });
            render();
            return;
        }
        // 가장 짧은 모드를 기본 선택
        let shortest = null, shortestVal = Infinity;
        for (const [k, v] of Object.entries(results)) {
            if (v.durationValue && v.durationValue < shortestVal) {
                shortestVal = v.durationValue;
                shortest = k;
            }
        }
        results.selectedMode = shortest;
        Store.updateItineraryItem(trip.id, dayId, itemId, { travelInfo: results });
        // 다음 일정 시작시간 자동 계산
        autoCalcNextStartTime(dayId, itemId);
        render();
    }

    // 이동 수단 선택
    function selectTravelMode(dayId, itemId, mode) {
        const trip = Store.getCurrentTrip();
        if (!trip) return;
        const day = trip.days.find(d => d.id === dayId);
        if (!day) return;
        const item = day.items.find(i => i.id === itemId);
        if (!item || !item.travelInfo) return;
        Store.updateItineraryItem(trip.id, dayId, itemId, {
            travelInfo: { ...item.travelInfo, selectedMode: mode }
        });
        _fetchedPairs.clear();
        render();
    }

    // 이동 시간 직접 수정
    function editTravelTime(dayId, itemId) {
        const trip = Store.getCurrentTrip();
        if (!trip) return;
        const day = trip.days.find(d => d.id === dayId);
        if (!day) return;
        const item = day.items.find(i => i.id === itemId);
        if (!item) return;

        const info = item.travelInfo || {};
        const modes = [
            { key: 'walking', icon: '🚶', label: '도보' },
            { key: 'driving', icon: '🚗', label: '차량' },
            { key: 'transit', icon: '🚇', label: '대중교통' }
        ];

        const modeInputs = modes.map(m => {
            const data = info[m.key];
            return `<div class="form-row" style="align-items:center;gap:8px;margin-bottom:8px">
                <span style="width:80px;font-weight:500">${m.icon} ${m.label}</span>
                <input type="text" id="edit-travel-${m.key}-dur" value="${data ? data.duration : ''}" placeholder="예: 15분" style="flex:1" />
                <input type="text" id="edit-travel-${m.key}-dist" value="${data ? data.distance : ''}" placeholder="거리" style="flex:1" />
            </div>`;
        }).join('');

        UI.showModal('이동 시간 수정', `
            <p style="margin-bottom:12px;color:var(--text-secondary);font-size:0.85rem">각 이동수단별 소요 시간과 거리를 직접 입력하세요.</p>
            ${modeInputs}
            <div class="form-group" style="margin-top:8px">
                <label class="form-label">기본 이동수단</label>
                <select id="edit-travel-selected">
                    <option value="">선택 안함</option>
                    <option value="walking" ${info.selectedMode === 'walking' ? 'selected' : ''}>🚶 도보</option>
                    <option value="transit" ${info.selectedMode === 'transit' ? 'selected' : ''}>🚇 대중교통</option>
                    <option value="driving" ${info.selectedMode === 'driving' ? 'selected' : ''}>🚗 차량</option>
                </select>
            </div>
        `, `
            <button class="btn-outline" onclick="UI.closeModal()">취소</button>
            <button class="btn-primary" id="btn-save-travel">저장</button>
        `);

        setTimeout(() => {
            document.getElementById('btn-save-travel').onclick = () => {
                const newInfo = { selectedMode: document.getElementById('edit-travel-selected').value };
                modes.forEach(m => {
                    const dur = document.getElementById(`edit-travel-${m.key}-dur`).value.trim();
                    const dist = document.getElementById(`edit-travel-${m.key}-dist`).value.trim();
                    if (dur) {
                        newInfo[m.key] = {
                            duration: dur,
                            durationValue: info[m.key]?.durationValue || 0,
                            distance: dist || ''
                        };
                    }
                });
                Store.updateItineraryItem(trip.id, dayId, itemId, { travelInfo: newInfo });
                // 다음 일정 시작시간 자동 계산
                autoCalcNextStartTime(dayId, itemId);
                _fetchedPairs.clear();
                UI.closeModal();
                render();
                UI.showToast('이동 시간이 수정되었습니다', 'success');
            };
        }, 50);
    }

    // 종료시간 + 이동시간 → 다음 일정 시작시간 자동 계산
    function autoCalcNextStartTime(dayId, itemId) {
        const trip = Store.getCurrentTrip();
        if (!trip) return;
        const day = trip.days.find(d => d.id === dayId);
        if (!day) return;
        const idx = day.items.findIndex(i => i.id === itemId);
        if (idx === -1 || idx >= day.items.length - 1) return;

        const item = day.items[idx];
        const nextItem = day.items[idx + 1];
        if (!item.endTime) return;

        // 이동시간 (분) 계산
        let travelMinutes = 0;
        const info = item.travelInfo;
        if (info && !info.noRoute) {
            const mode = info.selectedMode;
            const modeData = mode && info[mode];
            if (modeData) {
                if (modeData.durationValue) {
                    travelMinutes = Math.ceil(modeData.durationValue / 60);
                } else if (modeData.duration) {
                    // "시간 분" 형식 파싱
                    const hMatch = modeData.duration.match(/(\d+)\s*시간/);
                    const mMatch = modeData.duration.match(/(\d+)\s*분/);
                    travelMinutes = (hMatch ? parseInt(hMatch[1]) * 60 : 0) + (mMatch ? parseInt(mMatch[1]) : 0);
                    if (travelMinutes === 0) {
                        // "15 min" / "1 hour 20 mins" 영어 형식
                        const hE = modeData.duration.match(/(\d+)\s*hour/);
                        const mE = modeData.duration.match(/(\d+)\s*min/);
                        travelMinutes = (hE ? parseInt(hE[1]) * 60 : 0) + (mE ? parseInt(mE[1]) : 0);
                    }
                }
            }
        }

        // 시간 계산
        const [h, m] = item.endTime.split(':').map(Number);
        if (isNaN(h) || isNaN(m)) return;
        const totalMin = h * 60 + m + travelMinutes;
        const newH = Math.floor(totalMin / 60) % 24;
        const newM = totalMin % 60;
        const newStart = `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;

        Store.updateItineraryItem(trip.id, dayId, nextItem.id, { startTime: newStart });
    }

    // 시간 인라인 수정
    function editTimeInline(e, dayId, itemId, field) {
        e.stopPropagation();
        const span = e.target.closest('.item-time-start, .item-time-end');
        if (!span || span.querySelector('input')) return;

        const trip = Store.getCurrentTrip();
        if (!trip) return;
        const day = trip.days.find(d => d.id === dayId);
        if (!day) return;
        const item = day.items.find(i => i.id === itemId);
        if (!item) return;

        const currentVal = field === 'start' ? (item.startTime || '') : (item.endTime || '');
        const input = document.createElement('input');
        input.type = 'time';
        input.className = 'item-time-input';
        input.value = currentVal;

        const originalText = span.textContent;
        span.textContent = '';
        span.appendChild(input);
        input.focus();

        function save() {
            const newVal = input.value;
            const updates = field === 'start' ? { startTime: newVal } : { endTime: newVal };
            Store.updateItineraryItem(trip.id, dayId, itemId, updates);
            span.textContent = newVal || '--:--';
            input.remove();
            // 종료시간 변경 시 다음 일정 시작시간 자동 계산
            if (field === 'end' && newVal) {
                autoCalcNextStartTime(dayId, itemId);
                render();
            }
        }

        input.addEventListener('blur', save);
        input.addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter') { ev.preventDefault(); save(); }
            if (ev.key === 'Escape') { span.textContent = originalText; input.remove(); }
        });
    }

    function addDay() {
        const trip = Store.getCurrentTrip();
        if (!trip) {
            UI.showToast('먼저 여행을 생성해주세요', 'warning');
            return;
        }
        Store.addDay(trip.id);
        render();
        App.updateDashboard();
        UI.showToast('새 일차가 추가되었습니다', 'success');
    }

    function removeDay(dayId) {
        UI.showConfirm('이 일차를 삭제하시겠습니까? 포함된 모든 일정이 함께 삭제됩니다.', () => {
            const trip = Store.getCurrentTrip();
            if (trip) {
                Store.removeDay(trip.id, dayId);
                render();
                App.updateDashboard();
                UI.showToast('일차가 삭제되었습니다', 'success');
            }
        });
    }

    function showAddItemModal(dayId, insertIndex) {
        const trip = Store.getCurrentTrip();
        if (!trip) return;

        const catOptions = Object.entries(UI.categoryInfo).map(([key, val]) =>
            `<option value="${key}">${val.icon} ${val.label}</option>`
        ).join('');

        UI.showModal('일정 추가', `
            <div class="form-group" style="background:var(--primary-bg);padding:16px;border-radius:var(--radius-md);border:1.5px dashed var(--primary-light)">
                <label class="form-label" style="color:var(--primary);display:flex;align-items:center;gap:6px">
                    <span class="material-symbols-rounded" style="font-size:1.1rem">search</span>
                    Google Maps에서 장소 검색
                </label>
                <div style="display:flex;gap:8px">
                    <input type="text" id="item-place-search" placeholder="장소명 검색 (예: 도쿄타워, 을지로 맛집...)" style="flex:1" />
                    <button class="btn-primary btn-sm" id="btn-place-search" type="button" style="white-space:nowrap">
                        <span class="material-symbols-rounded" style="font-size:1rem">search</span> 검색
                    </button>
                </div>
                <div id="item-search-results" class="item-search-results" style="display:none;margin-top:8px;max-height:200px;overflow-y:auto;border:1px solid var(--border-light);border-radius:var(--radius-sm)"></div>
            </div>
            <div style="display:flex;align-items:center;gap:12px;margin:12px 0;color:var(--text-tertiary);font-size:0.8rem">
                <div style="flex:1;height:1px;background:var(--border)"></div>
                <span>또는 Google Maps 링크</span>
                <div style="flex:1;height:1px;background:var(--border)"></div>
            </div>
            <div class="form-group">
                <div style="display:flex;gap:8px">
                    <input type="text" id="item-gmaps-link" placeholder="Google Maps 링크를 붙여넣으세요" style="flex:1" />
                    <button class="btn-outline btn-sm" id="btn-parse-gmaps" type="button" style="white-space:nowrap">
                        <span class="material-symbols-rounded" style="font-size:1rem">link</span> 자동 입력
                    </button>
                </div>
                <div id="gmaps-parse-status" style="display:none;margin-top:8px;font-size:0.82rem;padding:8px 12px;border-radius:var(--radius-sm)"></div>
            </div>
            <div style="display:flex;align-items:center;gap:12px;margin:12px 0;color:var(--text-tertiary);font-size:0.8rem">
                <div style="flex:1;height:1px;background:var(--border)"></div>
                <span>직접 입력</span>
                <div style="flex:1;height:1px;background:var(--border)"></div>
            </div>
            <div class="form-group">
                <label class="form-label">장소 / 일정명 *</label>
                <input type="text" id="item-title" placeholder="예: 에펠탑, 이치란 라멘" />
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">카테고리</label>
                    <select id="item-category">${catOptions}</select>
                </div>
                <div class="form-group">
                    <label class="form-label">예상 비용</label>
                    <input type="number" id="item-cost" placeholder="0" />
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">시작 시간</label>
                    <input type="time" id="item-start-time" />
                </div>
                <div class="form-group">
                    <label class="form-label">종료 시간</label>
                    <input type="time" id="item-end-time" />
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">주소 / 위치</label>
                <input type="text" id="item-address" placeholder="주소 또는 위치 정보" />
            </div>
            <div class="form-group">
                <label class="form-label">메모</label>
                <textarea id="item-notes" placeholder="참고 사항, 팁 등을 적어주세요"></textarea>
            </div>
            <div class="form-group">
                <label class="form-label">이미지 URL (선택)</label>
                <input type="text" id="item-image" placeholder="이미지 URL (비우면 자동 검색)" />
                <p class="form-hint">비워두시면 장소명으로 이미지를 자동 검색합니다</p>
            </div>
        `, `
            <button class="btn-outline" onclick="UI.closeModal()">취소</button>
            <button class="btn-primary" id="btn-save-item">저장</button>
        `);

        setTimeout(() => {
            // ===== 장소 검색 기능 =====
            let _searchPlaceData = null; // 검색으로 선택된 장소 데이터
            const searchInput = document.getElementById('item-place-search');
            const searchBtn = document.getElementById('btn-place-search');
            const searchResults = document.getElementById('item-search-results');

            function doPlaceSearch() {
                const q = searchInput.value.trim();
                if (!q) return;
                if (typeof google === 'undefined' || !google.maps) {
                    UI.showToast('Google Maps API를 로드할 수 없습니다', 'warning');
                    return;
                }
                // PlacesService 를 위한 임시 div
                let svcDiv = document.getElementById('_item-places-svc');
                if (!svcDiv) { svcDiv = document.createElement('div'); svcDiv.id = '_item-places-svc'; document.body.appendChild(svcDiv); }
                const svc = new google.maps.places.PlacesService(svcDiv);
                searchResults.style.display = 'block';
                searchResults.innerHTML = '<div style="padding:12px;text-align:center;color:var(--text-tertiary);font-size:0.8rem">검색 중...</div>';
                svc.textSearch({ query: q }, (results, status) => {
                    if (status === google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
                        const max = Math.min(results.length, 8);
                        searchResults.innerHTML = '';
                        for (let i = 0; i < max; i++) {
                            const p = results[i];
                            const addr = p.formatted_address || p.vicinity || '';
                            const rating = p.rating ? `⭐${p.rating}` : '';
                            const div = document.createElement('div');
                            div.className = 'item-search-result';
                            div.innerHTML = `<div class="item-search-result-name">${UI.escapeHtml(p.name)}</div>
                                <div class="item-search-result-meta">${rating} ${UI.escapeHtml(addr)}</div>`;
                            div.addEventListener('click', () => selectSearchedPlace(p));
                            searchResults.appendChild(div);
                        }
                    } else {
                        searchResults.innerHTML = '<div style="padding:12px;text-align:center;color:var(--text-tertiary);font-size:0.8rem">검색 결과가 없습니다</div>';
                    }
                });
            }

            function selectSearchedPlace(place) {
                const lat = place.geometry.location.lat();
                const lng = place.geometry.location.lng();
                document.getElementById('item-title').value = place.name || '';
                document.getElementById('item-address').value = place.formatted_address || place.vicinity || '';
                // 카테고리 자동 감지
                const types = place.types || [];
                if (types.some(t => /restaurant|food|cafe|bakery|meal/.test(t))) {
                    document.getElementById('item-category').value = 'food';
                } else if (types.some(t => /lodging|hotel/.test(t))) {
                    document.getElementById('item-category').value = 'accommodation';
                } else if (types.some(t => /store|shop|mall/.test(t))) {
                    document.getElementById('item-category').value = 'shopping';
                } else if (types.some(t => /museum|art_gallery|amusement|zoo|aquarium/.test(t))) {
                    document.getElementById('item-category').value = 'activity';
                }
                // 이미지
                if (place.photos && place.photos[0]) {
                    document.getElementById('item-image').value = place.photos[0].getUrl({ maxWidth: 400 });
                }
                _searchPlaceData = { lat, lng, placeId: place.place_id };
                searchResults.style.display = 'none';
                searchInput.value = place.name;
                UI.showToast(`"${place.name}" 선택됨`, 'success');
            }

            searchBtn.addEventListener('click', doPlaceSearch);
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); doPlaceSearch(); }
            });

            // ===== Google Maps 링크 자동 파싱 =====
            const gmapsInput = document.getElementById('item-gmaps-link');
            const parseBtn = document.getElementById('btn-parse-gmaps');
            const statusEl = document.getElementById('gmaps-parse-status');

            function showParseStatus(message, type) {
                statusEl.style.display = 'block';
                statusEl.style.background = type === 'success' ? 'rgba(16,185,129,0.1)' : type === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(59,130,246,0.1)';
                statusEl.style.color = type === 'success' ? 'var(--success)' : type === 'error' ? 'var(--danger)' : 'var(--info)';
                statusEl.innerHTML = message;
            }

            async function handleGmapsParse() {
                const url = gmapsInput.value.trim();
                if (!url) {
                    UI.showToast('Google Maps 링크를 입력해주세요', 'warning');
                    return;
                }

                const parsed = UI.parseGoogleMapsUrl(url);
                if (!parsed) {
                    showParseStatus('⚠️ 유효한 Google Maps 링크가 아닙니다. 구글맵에서 복사한 링크를 붙여넣어주세요.', 'error');
                    return;
                }

                showParseStatus('⏳ 장소 정보를 가져오는 중...', 'info');
                parseBtn.disabled = true;
                parseBtn.innerHTML = '<span class="material-symbols-rounded" style="font-size:1rem;animation:spin 1s linear infinite">progress_activity</span> 분석 중';

                // URL에서 추출한 정보 채우기
                if (parsed.title) {
                    document.getElementById('item-title').value = parsed.title;
                }

                if (parsed.address) {
                    document.getElementById('item-address').value = parsed.address;
                }

                // 좌표가 있으면 역지오코딩으로 추가 정보 가져오기
                if (parsed.lat && parsed.lng) {
                    const geo = await UI.reverseGeocode(parsed.lat, parsed.lng);
                    if (geo) {
                        if (!parsed.title && geo.name) {
                            document.getElementById('item-title').value = geo.name;
                        }
                        if (geo.address) {
                            document.getElementById('item-address').value = geo.address;
                        }
                        // 장소 타입에 따라 카테고리 자동 추정
                        const titleVal = document.getElementById('item-title').value.toLowerCase();
                        const addrVal = (geo.address || '').toLowerCase();
                        if (/restaurant|식당|레스토랑|라멘|ramen|cafe|카페|coffee|bakery|베이커리/i.test(titleVal + ' ' + addrVal)) {
                            document.getElementById('item-category').value = 'food';
                        } else if (/hotel|호텔|hostel|inn|숙소|게스트하우스|리조트|resort|airbnb/i.test(titleVal)) {
                            document.getElementById('item-category').value = 'accommodation';
                        } else if (/museum|박물관|미술관|gallery|극장|theater|theatre/i.test(titleVal)) {
                            document.getElementById('item-category').value = 'entertainment';
                        } else if (/mall|마트|market|시장|쇼핑|shop|store|백화점/i.test(titleVal)) {
                            document.getElementById('item-category').value = 'shopping';
                        }
                    }

                    // 좌표 기반 이미지 자동 설정
                    const titleForImg = document.getElementById('item-title').value;
                    if (titleForImg && !document.getElementById('item-image').value) {
                        document.getElementById('item-image').value = UI.getPlaceImage(titleForImg);
                    }

                    showParseStatus(
                        `✅ 장소 정보를 가져왔습니다!<br><strong>${UI.escapeHtml(document.getElementById('item-title').value)}</strong>` +
                        `<br><span style="font-size:0.75rem;opacity:0.7">📍 ${parsed.lat.toFixed(5)}, ${parsed.lng.toFixed(5)}</span>`,
                        'success'
                    );
                } else if (parsed.title) {
                    // 좌표 없이 장소명만 있는 경우
                    if (!document.getElementById('item-image').value) {
                        document.getElementById('item-image').value = UI.getPlaceImage(parsed.title);
                    }
                    showParseStatus(
                        `✅ 장소명을 가져왔습니다: <strong>${UI.escapeHtml(parsed.title)}</strong>` +
                        `<br><span style="font-size:0.75rem;opacity:0.7">주소와 추가 정보를 직접 입력해주세요</span>`,
                        'success'
                    );
                } else {
                    showParseStatus('⚠️ 링크에서 장소 정보를 추출하지 못했습니다. 직접 입력해주세요.', 'error');
                }

                parseBtn.disabled = false;
                parseBtn.innerHTML = '<span class="material-symbols-rounded" style="font-size:1rem">auto_fix_high</span> 자동 입력';
            }

            parseBtn.onclick = handleGmapsParse;
            gmapsInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); handleGmapsParse(); }
            });
            // 붙여넣기 시 자동 파싱
            gmapsInput.addEventListener('paste', () => {
                setTimeout(handleGmapsParse, 100);
            });

            document.getElementById('btn-save-item').onclick = () => {
                const title = document.getElementById('item-title').value.trim();
                if (!title) {
                    UI.showToast('장소명을 입력해주세요', 'warning');
                    return;
                }
                const imageUrl = document.getElementById('item-image').value.trim() || UI.getPlaceImage(title, document.getElementById('item-category').value);

                const gmapsParsed = UI.parseGoogleMapsUrl(gmapsInput.value.trim());

                const newItem = Store.addItineraryItem(trip.id, dayId, {
                    title,
                    category: document.getElementById('item-category').value,
                    startTime: document.getElementById('item-start-time').value,
                    endTime: document.getElementById('item-end-time').value,
                    address: document.getElementById('item-address').value.trim(),
                    notes: document.getElementById('item-notes').value.trim(),
                    cost: Number(document.getElementById('item-cost').value) || 0,
                    imageUrl,
                    lat: _searchPlaceData?.lat || gmapsParsed?.lat || null,
                    lng: _searchPlaceData?.lng || gmapsParsed?.lng || null,
                    placeId: _searchPlaceData?.placeId || null
                });

                // insertIndex가 지정되면 해당 위치로 이동
                if (typeof insertIndex === 'number' && newItem) {
                    const day = trip.days.find(d => d.id === dayId);
                    if (day && day.items.length > 1) {
                        // 방금 추가된 아이템은 맨 뒤에 있으므로 원하는 위치로 이동
                        const removed = day.items.pop();
                        day.items.splice(insertIndex, 0, removed);
                        Store.save();
                    }
                }

                UI.closeModal();
                render();
                App.updateDashboard();
                Store.addActivity(trip.id, '일정 추가', `"${title}" 추가`);
                UI.showToast(`"${title}" 이(가) 추가되었습니다`, 'success');
            };
            document.getElementById('item-place-search').focus();
        }, 50);
    }

    function showEditItemModal(dayId, itemId) {
        const trip = Store.getCurrentTrip();
        if (!trip) return;
        const day = trip.days.find(d => d.id === dayId);
        if (!day) return;
        const item = day.items.find(i => i.id === itemId);
        if (!item) return;

        const catOptions = Object.entries(UI.categoryInfo).map(([key, val]) =>
            `<option value="${key}" ${item.category === key ? 'selected' : ''}>${val.icon} ${val.label}</option>`
        ).join('');

        UI.showModal('일정 수정', `
            <div class="form-group">
                <label class="form-label">장소 / 일정명 *</label>
                <input type="text" id="item-title" value="${UI.escapeHtml(item.title)}" />
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">카테고리</label>
                    <select id="item-category">${catOptions}</select>
                </div>
                <div class="form-group">
                    <label class="form-label">예상 비용</label>
                    <input type="number" id="item-cost" value="${item.cost || ''}" />
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">시작 시간</label>
                    <input type="time" id="item-start-time" value="${item.startTime || ''}" />
                </div>
                <div class="form-group">
                    <label class="form-label">종료 시간</label>
                    <input type="time" id="item-end-time" value="${item.endTime || ''}" />
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">주소 / 위치</label>
                <input type="text" id="item-address" value="${UI.escapeHtml(item.address)}" />
            </div>
            <div class="form-group">
                <label class="form-label">메모</label>
                <textarea id="item-notes">${UI.escapeHtml(item.notes)}</textarea>
            </div>
            <div class="form-group">
                <label class="form-label">이미지 URL</label>
                <input type="text" id="item-image" value="${UI.escapeHtml(item.imageUrl)}" />
            </div>
        `, `
            <button class="btn-outline" onclick="UI.closeModal()">취소</button>
            <button class="btn-primary" id="btn-save-item">저장</button>
        `);

        setTimeout(() => {
            document.getElementById('btn-save-item').onclick = () => {
                const title = document.getElementById('item-title').value.trim();
                if (!title) {
                    UI.showToast('장소명을 입력해주세요', 'warning');
                    return;
                }
                Store.updateItineraryItem(trip.id, dayId, itemId, {
                    title,
                    category: document.getElementById('item-category').value,
                    startTime: document.getElementById('item-start-time').value,
                    endTime: document.getElementById('item-end-time').value,
                    address: document.getElementById('item-address').value.trim(),
                    notes: document.getElementById('item-notes').value.trim(),
                    cost: Number(document.getElementById('item-cost').value) || 0,
                    imageUrl: document.getElementById('item-image').value.trim()
                });
                UI.closeModal();
                render();
                Store.addActivity(trip.id, '일정 수정', `"${title}" 수정`);
                UI.showToast('일정이 수정되었습니다', 'success');
            };
        }, 50);
    }

    function removeItem(dayId, itemId) {
        UI.showConfirm('이 일정을 삭제하시겠습니까?', () => {
            const trip = Store.getCurrentTrip();
            if (trip) {
                const day = trip.days.find(d => d.id === dayId);
                const item = day?.items.find(i => i.id === itemId);
                const title = item?.title || '';
                Store.removeItineraryItem(trip.id, dayId, itemId);
                render();
                App.updateDashboard();
                Store.addActivity(trip.id, '일정 삭제', `"${title}" 삭제`);
                UI.showToast('일정이 삭제되었습니다', 'success');
            }
        });
    }

    function toggleFavorite(dayId, itemId) {
        const trip = Store.getCurrentTrip();
        if (!trip) return;
        const isFav = Store.toggleFavorite(trip.id, dayId, itemId);
        render();
        UI.showToast(isFav ? '즐겨찾기에 추가되었습니다' : '즐겨찾기에서 제거되었습니다', 'success');
    }

    function addComment(dayId, itemId, text, inputEl) {
        if (!text.trim()) return;
        const trip = Store.getCurrentTrip();
        if (!trip) return;
        Store.addComment(trip.id, dayId, itemId, text.trim(), Store.getSettings().userName);
        inputEl.value = '';
        render();
    }

    // ===== 일정 후보 관리 (일정 페이지) =====
    function renderItineraryCandidates() {
        const trip = Store.getCurrentTrip();
        const list = document.getElementById('itinerary-candidates-list');
        const countEl = document.getElementById('itinerary-candidates-count');
        if (!list) return;

        const candidates = trip ? Store.getCandidates(trip.id) : [];
        if (countEl) countEl.textContent = candidates.length;

        if (candidates.length === 0) {
            list.innerHTML = `<div class="empty-state-sm"><p>일정 후보가 없습니다. 지도에서 장소를 검색하고 후보에 추가해보세요.</p></div>`;
            return;
        }

        const dayOptions = trip.days.map(d =>
            `<option value="${d.id}">Day ${d.dayNumber}</option>`
        ).join('');

        list.innerHTML = candidates.map(c => {
            const catInfo = UI.categoryInfo[c.category] || UI.categoryInfo.place;
            return `<div class="itin-candidate-item" data-candidate-id="${c.id}" draggable="true">
                <div class="itin-candidate-left">
                    <div class="item-drag-handle"><span class="material-symbols-rounded">drag_indicator</span></div>
                    <span class="itin-candidate-icon" style="background:${catInfo.color}15;color:${catInfo.color}">${catInfo.icon}</span>
                    <div class="itin-candidate-info">
                        <div class="itin-candidate-name">${UI.escapeHtml(c.title)}</div>
                        <div class="itin-candidate-addr">${UI.escapeHtml(c.address || '')}</div>
                        ${c.rating ? `<span class="itin-candidate-rating">⭐ ${c.rating}</span>` : ''}
                    </div>
                </div>
                <div class="itin-candidate-right">
                    <select class="itin-candidate-day" data-cid="${c.id}">${dayOptions}</select>
                    <button class="btn-sm-primary" onclick="Itinerary.addCandidateToDay('${c.id}', this)" title="일정에 추가">
                        <span class="material-symbols-rounded">add</span> 추가
                    </button>
                    <button class="btn-icon btn-sm" onclick="Itinerary.removeCandidateFromList('${c.id}')" title="후보 삭제">
                        <span class="material-symbols-rounded">close</span>
                    </button>
                </div>
            </div>`;
        }).join('');
    }

    function addCandidateToDay(candidateId, btnEl, directDayId) {
        const trip = Store.getCurrentTrip();
        if (!trip) return;
        const candidate = (trip.candidates || []).find(c => c.id === candidateId);
        if (!candidate) return;

        // directDayId가 있으면 (드래그 앤 드롭) 바로 사용, 아니면 select에서 가져오기
        let dayId = directDayId;
        if (!dayId && btnEl) {
            const selectEl = btnEl.parentElement.querySelector('.itin-candidate-day');
            dayId = selectEl ? selectEl.value : null;
        }
        if (!dayId) dayId = trip.days[0] && trip.days[0].id;
        if (!dayId) { UI.showToast('일차를 먼저 추가해주세요', 'warning'); return; }

        Store.addItineraryItem(trip.id, dayId, {
            title: candidate.title,
            category: candidate.category,
            address: candidate.address,
            lat: candidate.lat,
            lng: candidate.lng,
            placeId: candidate.placeId || null,
            imageUrl: candidate.imageUrl || '',
            notes: candidate.notes || ''
        });

        // 후보에서 제거
        Store.removeCandidate(trip.id, candidateId);
        _fetchedPairs.clear();
        render();
        UI.showToast(`"${candidate.title}" 일정에 추가됨`, 'success');
    }

    function removeCandidateFromList(candidateId) {
        const trip = Store.getCurrentTrip();
        if (!trip) return;
        Store.removeCandidate(trip.id, candidateId);
        renderItineraryCandidates();
        UI.showToast('후보에서 삭제됨', 'info');
    }

    function moveItemToCandidate(dayId, itemId) {
        const trip = Store.getCurrentTrip();
        if (!trip) return;
        const day = trip.days.find(d => d.id === dayId);
        if (!day) return;
        const item = day.items.find(i => i.id === itemId);
        if (!item) return;

        // 후보에 추가
        Store.addCandidate(trip.id, {
            title: item.title,
            category: item.category,
            address: item.address,
            lat: item.lat,
            lng: item.lng,
            imageUrl: item.imageUrl,
            placeId: item.placeId || null,
            rating: null,
            notes: item.notes
        });

        // 일정에서 제거
        Store.removeItineraryItem(trip.id, dayId, itemId);
        _fetchedPairs.clear();
        render();
        App.updateDashboard();
        UI.showToast(`"${item.title}" 후보로 이동됨`, 'success');
    }

    function initCandidatesPanel() {
        const toggle = document.getElementById('itinerary-candidates-toggle');
        if (toggle) {
            toggle.addEventListener('click', () => {
                const panel = document.getElementById('itinerary-candidates-panel');
                if (panel) panel.classList.toggle('open');
                const body = document.getElementById('itinerary-candidates-body');
                if (body) body.classList.toggle('open');
            });
        }
    }

    return {
        render, addDay, removeDay,
        showAddItemModal, showEditItemModal,
        removeItem, toggleFavorite, addComment, editTimeInline,
        selectTravelMode, editTravelTime, moveItemToCandidate,
        addCandidateToDay, removeCandidateFromList,
        initCandidatesPanel
    };
})();

// ========== 예약 관리 ==========
const Reservations = (() => {
    let currentFilter = 'all';

    function render() {
        const trip = Store.getCurrentTrip();
        const container = document.getElementById('reservations-content');
        if (!trip || trip.reservations.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📋</div>
                    <h3>등록된 예약이 없습니다</h3>
                    <p>항공, 숙소, 식당 등의 예약 정보를 추가해보세요</p>
                    <button class="btn-primary" onclick="Reservations.showAddModal()">
                        <span class="material-symbols-rounded">add</span> 예약 추가하기
                    </button>
                </div>`;
            return;
        }

        const filtered = currentFilter === 'all'
            ? trip.reservations
            : trip.reservations.filter(r => r.type === currentFilter);

        if (filtered.length === 0) {
            container.innerHTML = `<div class="empty-state-sm"><p>해당 카테고리의 예약이 없습니다</p></div>`;
            return;
        }

        container.innerHTML = '<div class="reservations-grid">' + filtered.map(renderCard).join('') + '</div>';
    }

    function renderCard(res) {
        const typeInfo = UI.reservationTypeInfo[res.type] || UI.reservationTypeInfo.other;
        const statusColors = { confirmed: 'var(--success)', pending: 'var(--warning)', cancelled: 'var(--danger)' };
        const statusLabels = { confirmed: '확정', pending: '대기중', cancelled: '취소됨' };

        let detailsHTML = '';
        const details = res.details || {};
        if (res.type === 'flight') {
            detailsHTML = `
                ${details.departure ? `<div class="reservation-detail"><span class="material-symbols-rounded">flight_takeoff</span><span>${UI.escapeHtml(details.departure)}</span></div>` : ''}
                ${details.arrival ? `<div class="reservation-detail"><span class="material-symbols-rounded">flight_land</span><span>${UI.escapeHtml(details.arrival)}</span></div>` : ''}
                ${details.airline ? `<div class="reservation-detail"><span class="material-symbols-rounded">airlines</span><span>${UI.escapeHtml(details.airline)}</span></div>` : ''}
            `;
        }

        return `
            <div class="reservation-card">
                <div class="reservation-card-header">
                    <span class="reservation-type-icon">${typeInfo.icon}</span>
                    <div>
                        <span class="reservation-type-label">${typeInfo.label}</span>
                        <div class="reservation-name">${UI.escapeHtml(res.name)}</div>
                    </div>
                    <span style="margin-left:auto;font-size:0.75rem;padding:3px 10px;border-radius:20px;background:${statusColors[res.status]}20;color:${statusColors[res.status]};font-weight:600">${statusLabels[res.status]}</span>
                </div>
                <div class="reservation-card-body">
                    <div class="reservation-detail">
                        <span class="material-symbols-rounded">calendar_today</span>
                        <span>${UI.formatDate(res.date)}${res.time ? ' ' + res.time : ''}${res.endDate ? ' ~ ' + UI.formatDate(res.endDate) : ''}</span>
                    </div>
                    ${res.location ? `<div class="reservation-detail"><span class="material-symbols-rounded">location_on</span><span>${UI.escapeHtml(res.location)}</span></div>` : ''}
                    ${res.cost ? `<div class="reservation-detail"><span class="material-symbols-rounded">payments</span><span>${UI.formatCurrency(res.cost)}</span></div>` : ''}
                    ${detailsHTML}
                    ${res.confirmationNumber ? `
                        <div class="reservation-confirmation">
                            <span class="material-symbols-rounded">verified</span>
                            <span>예약번호: <strong>${UI.escapeHtml(res.confirmationNumber)}</strong></span>
                        </div>` : ''}
                    ${res.notes ? `<div style="margin-top:10px;font-size:0.85rem;color:var(--text-secondary)">${UI.escapeHtml(res.notes)}</div>` : ''}
                </div>
                <div class="reservation-card-footer">
                    <button class="btn-text btn-sm" onclick="Reservations.showEditModal('${res.id}')">수정</button>
                    <button class="btn-text btn-sm text-danger" onclick="Reservations.remove('${res.id}')">삭제</button>
                </div>
            </div>`;
    }

    function showAddModal() {
        const trip = Store.getCurrentTrip();
        if (!trip) { UI.showToast('먼저 여행을 생성해주세요', 'warning'); return; }

        const typeOptions = Object.entries(UI.reservationTypeInfo).map(([key, val]) =>
            `<option value="${key}">${val.icon} ${val.label}</option>`
        ).join('');

        UI.showModal('예약 추가', `
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">유형 *</label>
                    <select id="res-type">${typeOptions}</select>
                </div>
                <div class="form-group">
                    <label class="form-label">상태</label>
                    <select id="res-status">
                        <option value="confirmed">확정</option>
                        <option value="pending">대기중</option>
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">예약명 *</label>
                <input type="text" id="res-name" placeholder="예: 대한항공 KE001, 호텔 스카이뷰" />
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">날짜</label>
                    <input type="date" id="res-date" />
                </div>
                <div class="form-group">
                    <label class="form-label">시간</label>
                    <input type="time" id="res-time" />
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">종료 날짜</label>
                    <input type="date" id="res-end-date" />
                </div>
                <div class="form-group">
                    <label class="form-label">비용</label>
                    <input type="number" id="res-cost" placeholder="0" />
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">장소 / 위치</label>
                <input type="text" id="res-location" placeholder="장소명 또는 주소" />
            </div>
            <div class="form-group">
                <label class="form-label">예약 번호 / 확인 번호</label>
                <input type="text" id="res-confirmation" placeholder="예약 확인 번호" />
            </div>
            <div class="form-group">
                <label class="form-label">메모</label>
                <textarea id="res-notes" placeholder="추가 정보"></textarea>
            </div>
        `, `
            <button class="btn-outline" onclick="UI.closeModal()">취소</button>
            <button class="btn-primary" id="btn-save-res">저장</button>
        `);

        setTimeout(() => {
            document.getElementById('btn-save-res').onclick = () => {
                const name = document.getElementById('res-name').value.trim();
                if (!name) { UI.showToast('예약명을 입력해주세요', 'warning'); return; }

                Store.addReservation(trip.id, {
                    type: document.getElementById('res-type').value,
                    name,
                    status: document.getElementById('res-status').value,
                    date: document.getElementById('res-date').value,
                    time: document.getElementById('res-time').value,
                    endDate: document.getElementById('res-end-date').value,
                    location: document.getElementById('res-location').value.trim(),
                    confirmationNumber: document.getElementById('res-confirmation').value.trim(),
                    cost: Number(document.getElementById('res-cost').value) || 0,
                    notes: document.getElementById('res-notes').value.trim()
                });

                UI.closeModal();
                render();
                UI.showToast('예약이 추가되었습니다', 'success');
            };
            document.getElementById('res-name').focus();
        }, 50);
    }

    function showEditModal(resId) {
        const trip = Store.getCurrentTrip();
        if (!trip) return;
        const res = trip.reservations.find(r => r.id === resId);
        if (!res) return;

        const typeOptions = Object.entries(UI.reservationTypeInfo).map(([key, val]) =>
            `<option value="${key}" ${res.type === key ? 'selected' : ''}>${val.icon} ${val.label}</option>`
        ).join('');

        UI.showModal('예약 수정', `
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">유형</label>
                    <select id="res-type">${typeOptions}</select>
                </div>
                <div class="form-group">
                    <label class="form-label">상태</label>
                    <select id="res-status">
                        <option value="confirmed" ${res.status === 'confirmed' ? 'selected' : ''}>확정</option>
                        <option value="pending" ${res.status === 'pending' ? 'selected' : ''}>대기중</option>
                        <option value="cancelled" ${res.status === 'cancelled' ? 'selected' : ''}>취소됨</option>
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">예약명 *</label>
                <input type="text" id="res-name" value="${UI.escapeHtml(res.name)}" />
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">날짜</label>
                    <input type="date" id="res-date" value="${res.date || ''}" />
                </div>
                <div class="form-group">
                    <label class="form-label">시간</label>
                    <input type="time" id="res-time" value="${res.time || ''}" />
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">종료 날짜</label>
                    <input type="date" id="res-end-date" value="${res.endDate || ''}" />
                </div>
                <div class="form-group">
                    <label class="form-label">비용</label>
                    <input type="number" id="res-cost" value="${res.cost || ''}" />
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">장소 / 위치</label>
                <input type="text" id="res-location" value="${UI.escapeHtml(res.location)}" />
            </div>
            <div class="form-group">
                <label class="form-label">예약 번호</label>
                <input type="text" id="res-confirmation" value="${UI.escapeHtml(res.confirmationNumber)}" />
            </div>
            <div class="form-group">
                <label class="form-label">메모</label>
                <textarea id="res-notes">${UI.escapeHtml(res.notes)}</textarea>
            </div>
        `, `
            <button class="btn-outline" onclick="UI.closeModal()">취소</button>
            <button class="btn-primary" id="btn-save-res">저장</button>
        `);

        setTimeout(() => {
            document.getElementById('btn-save-res').onclick = () => {
                const name = document.getElementById('res-name').value.trim();
                if (!name) { UI.showToast('예약명을 입력해주세요', 'warning'); return; }

                Store.updateReservation(trip.id, resId, {
                    type: document.getElementById('res-type').value,
                    name,
                    status: document.getElementById('res-status').value,
                    date: document.getElementById('res-date').value,
                    time: document.getElementById('res-time').value,
                    endDate: document.getElementById('res-end-date').value,
                    location: document.getElementById('res-location').value.trim(),
                    confirmationNumber: document.getElementById('res-confirmation').value.trim(),
                    cost: Number(document.getElementById('res-cost').value) || 0,
                    notes: document.getElementById('res-notes').value.trim()
                });

                UI.closeModal();
                render();
                UI.showToast('예약이 수정되었습니다', 'success');
            };
        }, 50);
    }

    function remove(resId) {
        UI.showConfirm('이 예약을 삭제하시겠습니까?', () => {
            const trip = Store.getCurrentTrip();
            if (trip) {
                Store.removeReservation(trip.id, resId);
                render();
                UI.showToast('예약이 삭제되었습니다', 'success');
            }
        });
    }

    function setFilter(filter) {
        currentFilter = filter;
        document.querySelectorAll('.reservation-tabs .tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === filter);
        });
        render();
    }

    return { render, showAddModal, showEditModal, remove, setFilter };
})();

// ========== 예산 / 정산 ==========
const Budget = (() => {
    let currentTab = 'expenses';

    function render() {
        const trip = Store.getCurrentTrip();
        if (!trip) return;

        const totalSpent = Store.getTotalExpenses(trip.id);
        const totalBudget = trip.totalBudget || 0;
        const remaining = totalBudget - totalSpent;
        const percentage = totalBudget > 0 ? Math.min((totalSpent / totalBudget) * 100, 100) : 0;
        const memberCount = trip.members.length || 1;

        document.getElementById('total-budget').textContent = totalBudget.toLocaleString('ko-KR');
        document.getElementById('budget-spent').textContent = UI.formatCurrency(totalSpent);
        document.getElementById('budget-remaining').textContent = UI.formatCurrency(remaining);
        document.getElementById('budget-per-person').textContent = UI.formatCurrency(Math.round(totalSpent / memberCount));

        const barFill = document.getElementById('budget-bar-fill');
        barFill.style.width = percentage + '%';
        barFill.className = 'budget-bar-fill' + (percentage > 90 ? ' danger' : percentage > 70 ? ' warning' : '');

        renderTab();
    }

    function renderTab() {
        const trip = Store.getCurrentTrip();
        const container = document.getElementById('budget-tab-content');
        if (!trip) return;

        if (currentTab === 'expenses') {
            if (trip.expenses.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon">💰</div>
                        <h3>지출 내역이 없습니다</h3>
                        <p>여행 경비를 기록하고 편리하게 정산하세요</p>
                        <button class="btn-primary" onclick="Budget.showAddModal()">
                            <span class="material-symbols-rounded">add</span> 지출 추가하기
                        </button>
                    </div>`;
                return;
            }

            const sorted = [...trip.expenses].sort((a, b) => new Date(b.date) - new Date(a.date));
            container.innerHTML = `<div class="expense-list">${sorted.map(renderExpenseItem).join('')}</div>`;
        } else if (currentTab === 'category') {
            renderCategoryView(trip, container);
        } else if (currentTab === 'settlement') {
            renderSettlementView(trip, container);
        }
    }

    function renderExpenseItem(exp) {
        const catInfo = UI.expenseCategoryInfo[exp.category] || UI.expenseCategoryInfo.etc;
        const trip = Store.getCurrentTrip();
        const payer = trip ? trip.members.find(m => m.id === exp.paidBy) : null;

        return `
            <div class="expense-item">
                <span class="expense-icon">${catInfo.icon}</span>
                <div class="expense-info">
                    <div class="expense-name">${UI.escapeHtml(exp.name)}</div>
                    <div class="expense-detail-line">
                        <span>${UI.formatDate(exp.date)}</span>
                        <span>·</span>
                        <span>${catInfo.label}</span>
                    </div>
                </div>
                <div style="text-align:right">
                    <div class="expense-amount">${UI.formatCurrency(exp.amount)}</div>
                    ${payer ? `<div class="expense-payer">${UI.escapeHtml(payer.name)} 결제</div>` : ''}
                </div>
                <div style="display:flex;gap:2px">
                    <button class="btn-icon btn-sm" onclick="Budget.showEditModal('${exp.id}')" title="수정">
                        <span class="material-symbols-rounded">edit</span>
                    </button>
                    <button class="btn-icon btn-sm" onclick="Budget.remove('${exp.id}')" title="삭제">
                        <span class="material-symbols-rounded">delete_outline</span>
                    </button>
                </div>
            </div>`;
    }

    function renderCategoryView(trip, container) {
        const cats = Store.getExpensesByCategory(trip.id);
        const total = Object.values(cats).reduce((s, v) => s + v, 0) || 1;
        const colors = ['#4F46E5', '#059669', '#D97706', '#DC2626', '#EC4899', '#0891B2', '#7C3AED', '#6B7280'];

        let barsHTML = Object.entries(cats).sort((a, b) => b[1] - a[1]).map(([key, val], i) => {
            const info = UI.expenseCategoryInfo[key] || UI.expenseCategoryInfo.etc;
            const pct = (val / total * 100).toFixed(1);
            return `
                <div class="category-bar-item">
                    <span class="category-bar-label">${info.icon} ${info.label}</span>
                    <div class="category-bar-track">
                        <div class="category-bar-value" style="width:${pct}%;background:${colors[i % colors.length]}"></div>
                    </div>
                    <span class="category-bar-amount">${UI.formatCurrency(val)}</span>
                </div>`;
        }).join('');

        if (!barsHTML) {
            container.innerHTML = `<div class="empty-state-sm"><p>지출 내역을 먼저 추가해주세요</p></div>`;
            return;
        }

        container.innerHTML = `<div class="category-bars">${barsHTML}</div>`;
    }

    function renderSettlementView(trip, container) {
        if (trip.expenses.length === 0 || trip.members.length < 2) {
            container.innerHTML = `
                <div class="empty-state-sm">
                    <span class="material-symbols-rounded">balance</span>
                    <p>${trip.members.length < 2 ? '정산을 위해 멤버를 2명 이상 추가해주세요' : '지출 내역을 먼저 추가해주세요'}</p>
                </div>`;
            return;
        }

        const settlement = Store.getSettlement(trip.id);

        let balanceHTML = settlement.balances.map(b => `
            <div class="settlement-row">
                <div style="min-width:80px;font-weight:600">${UI.escapeHtml(b.name)}</div>
                <div style="flex:1;font-size:0.85rem;color:var(--text-secondary)">
                    지불: ${UI.formatCurrency(b.paid)} / 부담: ${UI.formatCurrency(Math.round(b.owe))}
                </div>
                <div style="font-weight:700;color:${b.net >= 0 ? 'var(--success)' : 'var(--danger)'}">
                    ${b.net >= 0 ? '+' : ''}${UI.formatCurrency(Math.round(b.net))}
                </div>
            </div>
        `).join('');

        let txHTML = settlement.transactions.length > 0
            ? settlement.transactions.map(tx => `
                <div class="settlement-row">
                    <strong>${UI.escapeHtml(tx.from)}</strong>
                    <span class="settlement-arrow">→</span>
                    <strong>${UI.escapeHtml(tx.to)}</strong>
                    <span class="settlement-amount" style="margin-left:auto">${UI.formatCurrency(tx.amount)}</span>
                </div>
            `).join('')
            : '<p style="text-align:center;color:var(--text-tertiary);padding:16px">정산할 내역이 없습니다 👍</p>';

        container.innerHTML = `
            <div class="settlement-section">
                <div class="settlement-card">
                    <h4>👤 멤버별 정산 현황</h4>
                    ${balanceHTML}
                </div>
                <div class="settlement-card">
                    <h4>💸 정산 요약 (누가 누구에게)</h4>
                    ${txHTML}
                </div>
            </div>`;
    }

    function showAddModal() {
        const trip = Store.getCurrentTrip();
        if (!trip) { UI.showToast('먼저 여행을 생성해주세요', 'warning'); return; }

        const catOptions = Object.entries(UI.expenseCategoryInfo).map(([key, val]) =>
            `<option value="${key}">${val.icon} ${val.label}</option>`
        ).join('');

        const memberOptions = trip.members.map(m =>
            `<option value="${m.id}">${UI.escapeHtml(m.name)}</option>`
        ).join('');

        const memberChecks = trip.members.map(m =>
            `<label class="form-checkbox-label"><input type="checkbox" name="split-member" value="${m.id}" checked /><span>${UI.escapeHtml(m.name)}</span></label>`
        ).join('');

        UI.showModal('지출 추가', `
            <div class="form-group">
                <label class="form-label">지출 항목 *</label>
                <input type="text" id="exp-name" placeholder="예: 점심 식사, 택시비" />
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">금액 *</label>
                    <input type="number" id="exp-amount" placeholder="0" />
                </div>
                <div class="form-group">
                    <label class="form-label">카테고리</label>
                    <select id="exp-category">${catOptions}</select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">날짜</label>
                    <input type="date" id="exp-date" value="${new Date().toISOString().split('T')[0]}" />
                </div>
                <div class="form-group">
                    <label class="form-label">결제자</label>
                    <select id="exp-paid-by"><option value="">선택</option>${memberOptions}</select>
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">분담 대상</label>
                <div class="form-checkbox-group">${memberChecks}</div>
            </div>
            <div class="form-group">
                <label class="form-label">메모</label>
                <input type="text" id="exp-notes" placeholder="추가 메모" />
            </div>
        `, `
            <button class="btn-outline" onclick="UI.closeModal()">취소</button>
            <button class="btn-primary" id="btn-save-exp">저장</button>
        `);

        setTimeout(() => {
            document.getElementById('btn-save-exp').onclick = () => {
                const name = document.getElementById('exp-name').value.trim();
                const amount = Number(document.getElementById('exp-amount').value);
                if (!name || !amount) { UI.showToast('항목명과 금액을 입력해주세요', 'warning'); return; }

                const splitAmong = Array.from(document.querySelectorAll('input[name="split-member"]:checked')).map(cb => cb.value);

                Store.addExpense(trip.id, {
                    name,
                    amount,
                    category: document.getElementById('exp-category').value,
                    date: document.getElementById('exp-date').value,
                    paidBy: document.getElementById('exp-paid-by').value,
                    splitAmong,
                    notes: document.getElementById('exp-notes').value.trim()
                });

                UI.closeModal();
                render();
                App.updateDashboard();
                UI.showToast('지출이 추가되었습니다', 'success');
            };
            document.getElementById('exp-name').focus();
        }, 50);
    }

    function showEditModal(expId) {
        const trip = Store.getCurrentTrip();
        if (!trip) return;
        const exp = trip.expenses.find(e => e.id === expId);
        if (!exp) return;

        const catOptions = Object.entries(UI.expenseCategoryInfo).map(([key, val]) =>
            `<option value="${key}" ${exp.category === key ? 'selected' : ''}>${val.icon} ${val.label}</option>`
        ).join('');

        const memberOptions = trip.members.map(m =>
            `<option value="${m.id}" ${exp.paidBy === m.id ? 'selected' : ''}>${UI.escapeHtml(m.name)}</option>`
        ).join('');

        const memberChecks = trip.members.map(m =>
            `<label class="form-checkbox-label"><input type="checkbox" name="split-member" value="${m.id}" ${exp.splitAmong.includes(m.id) || exp.splitAmong.length === 0 ? 'checked' : ''} /><span>${UI.escapeHtml(m.name)}</span></label>`
        ).join('');

        UI.showModal('지출 수정', `
            <div class="form-group">
                <label class="form-label">지출 항목 *</label>
                <input type="text" id="exp-name" value="${UI.escapeHtml(exp.name)}" />
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">금액 *</label>
                    <input type="number" id="exp-amount" value="${exp.amount}" />
                </div>
                <div class="form-group">
                    <label class="form-label">카테고리</label>
                    <select id="exp-category">${catOptions}</select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">날짜</label>
                    <input type="date" id="exp-date" value="${exp.date}" />
                </div>
                <div class="form-group">
                    <label class="form-label">결제자</label>
                    <select id="exp-paid-by"><option value="">선택</option>${memberOptions}</select>
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">분담 대상</label>
                <div class="form-checkbox-group">${memberChecks}</div>
            </div>
            <div class="form-group">
                <label class="form-label">메모</label>
                <input type="text" id="exp-notes" value="${UI.escapeHtml(exp.notes)}" />
            </div>
        `, `
            <button class="btn-outline" onclick="UI.closeModal()">취소</button>
            <button class="btn-primary" id="btn-save-exp">저장</button>
        `);

        setTimeout(() => {
            document.getElementById('btn-save-exp').onclick = () => {
                const name = document.getElementById('exp-name').value.trim();
                const amount = Number(document.getElementById('exp-amount').value);
                if (!name || !amount) { UI.showToast('항목명과 금액을 입력해주세요', 'warning'); return; }

                const splitAmong = Array.from(document.querySelectorAll('input[name="split-member"]:checked')).map(cb => cb.value);

                Store.updateExpense(trip.id, expId, {
                    name, amount,
                    category: document.getElementById('exp-category').value,
                    date: document.getElementById('exp-date').value,
                    paidBy: document.getElementById('exp-paid-by').value,
                    splitAmong,
                    notes: document.getElementById('exp-notes').value.trim()
                });

                UI.closeModal();
                render();
                App.updateDashboard();
                UI.showToast('지출이 수정되었습니다', 'success');
            };
        }, 50);
    }

    function remove(expId) {
        UI.showConfirm('이 지출 내역을 삭제하시겠습니까?', () => {
            const trip = Store.getCurrentTrip();
            if (trip) {
                Store.removeExpense(trip.id, expId);
                render();
                App.updateDashboard();
                UI.showToast('지출이 삭제되었습니다', 'success');
            }
        });
    }

    function setTab(tab) {
        currentTab = tab;
        document.querySelectorAll('[data-budget-tab]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.budgetTab === tab);
        });
        renderTab();
    }

    function showEditBudgetModal() {
        const trip = Store.getCurrentTrip();
        if (!trip) return;

        UI.showModal('총 예산 설정', `
            <div class="form-group">
                <label class="form-label">총 예산 금액</label>
                <input type="number" id="budget-total-input" value="${trip.totalBudget || ''}" placeholder="예: 2000000" />
                <p class="form-hint">여행 전체의 총 예산을 입력해주세요</p>
            </div>
            <div class="form-group">
                <label class="form-label">통화</label>
                <select id="budget-currency-select">
                    <option value="KRW" ${Store.getSettings().currency === 'KRW' ? 'selected' : ''}>🇰🇷 원 (₩)</option>
                    <option value="USD" ${Store.getSettings().currency === 'USD' ? 'selected' : ''}>🇺🇸 달러 ($)</option>
                    <option value="EUR" ${Store.getSettings().currency === 'EUR' ? 'selected' : ''}>🇪🇺 유로 (€)</option>
                    <option value="JPY" ${Store.getSettings().currency === 'JPY' ? 'selected' : ''}>🇯🇵 엔 (¥)</option>
                    <option value="GBP" ${Store.getSettings().currency === 'GBP' ? 'selected' : ''}>🇬🇧 파운드 (£)</option>
                    <option value="THB" ${Store.getSettings().currency === 'THB' ? 'selected' : ''}>🇹🇭 바트 (฿)</option>
                </select>
            </div>
        `, `
            <button class="btn-outline" onclick="UI.closeModal()">취소</button>
            <button class="btn-primary" id="btn-save-budget">저장</button>
        `);

        setTimeout(() => {
            document.getElementById('btn-save-budget').onclick = () => {
                const budget = Number(document.getElementById('budget-total-input').value) || 0;
                const currency = document.getElementById('budget-currency-select').value;
                const symbols = { KRW: '₩', USD: '$', EUR: '€', JPY: '¥', GBP: '£', THB: '฿' };

                Store.updateTrip(trip.id, { totalBudget: budget });
                Store.updateSettings({ currency, currencySymbol: symbols[currency] || '₩' });

                UI.closeModal();
                render();
                App.updateDashboard();
                UI.showToast('예산이 설정되었습니다', 'success');
            };
        }, 50);
    }

    return { render, showAddModal, showEditModal, remove, setTab, showEditBudgetModal };
})();

// ========== 체크리스트 ==========
const Checklist = (() => {
    let _viewMode = 'category'; // 'category' | 'assignee'

    function render() {
        const trip = Store.getCurrentTrip();
        const container = document.getElementById('checklist-content');
        if (!trip || trip.checklist.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">✅</div>
                    <h3>체크리스트가 비어있습니다</h3>
                    <p>준비물, 할 일 등을 체크리스트로 관리하세요</p>
                    <button class="btn-primary" onclick="Checklist.showAddCategoryModal()">
                        <span class="material-symbols-rounded">add</span> 카테고리 추가하기
                    </button>
                </div>`;
            updateProgress(trip);
            return;
        }

        const viewToggle = `<div class="checklist-view-toggle" style="display:flex;gap:4px;margin-bottom:16px">
            <button class="btn-sm ${_viewMode === 'category' ? 'btn-primary' : 'btn-outline'}" onclick="Checklist.setViewMode('category')">카테고리별</button>
            <button class="btn-sm ${_viewMode === 'assignee' ? 'btn-primary' : 'btn-outline'}" onclick="Checklist.setViewMode('assignee')">담당자별</button>
        </div>`;

        if (_viewMode === 'assignee') {
            container.innerHTML = viewToggle + renderByAssignee(trip);
        } else {
            container.innerHTML = viewToggle + trip.checklist.map(renderCategory).join('');
        }
        updateProgress(trip);
    }

    function renderCategory(cat) {
        const checked = cat.items.filter(i => i.checked).length;
        const itemsHTML = cat.items.map(item => `
            <div class="checklist-item ${item.checked ? 'completed' : ''}">
                <div class="checklist-checkbox ${item.checked ? 'checked' : ''}" onclick="Checklist.toggleItem('${cat.id}','${item.id}')">
                    ${item.checked ? '<span class="material-symbols-rounded">check</span>' : ''}
                </div>
                <span class="checklist-item-text">${UI.escapeHtml(item.text)}</span>
                ${item.assignee ? `<span class="checklist-item-assignee">${UI.escapeHtml(item.assignee)}</span>` : ''}
                <button class="btn-icon btn-sm" onclick="Checklist.removeItem('${cat.id}','${item.id}')" style="opacity:0.5" title="삭제">
                    <span class="material-symbols-rounded" style="font-size:1rem">close</span>
                </button>
            </div>
        `).join('');

        return `
            <div class="checklist-category">
                <div class="checklist-category-header">
                    <div class="checklist-category-title">
                        <span>${cat.icon}</span>
                        <span>${UI.escapeHtml(cat.name)}</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:8px">
                        <span class="checklist-category-count">${checked} / ${cat.items.length}</span>
                        <button class="btn-icon btn-sm" onclick="Checklist.showAddItemModal('${cat.id}')" title="항목 추가">
                            <span class="material-symbols-rounded">add</span>
                        </button>
                        <button class="btn-icon btn-sm" onclick="Checklist.removeCategory('${cat.id}')" title="카테고리 삭제">
                            <span class="material-symbols-rounded">delete_outline</span>
                        </button>
                    </div>
                </div>
                <div class="checklist-items">
                    ${itemsHTML || '<div class="empty-state-sm" style="padding:16px"><p>항목을 추가해보세요</p></div>'}
                </div>
            </div>`;
    }

    function renderByAssignee(trip) {
        const groups = {};
        trip.checklist.forEach(cat => {
            (cat.items || []).forEach(item => {
                const key = item.assignee || '미배정';
                if (!groups[key]) groups[key] = [];
                groups[key].push({ ...item, catId: cat.id, catName: cat.name, catIcon: cat.icon });
            });
        });
        const sortedKeys = Object.keys(groups).sort((a, b) => a === '미배정' ? 1 : b === '미배정' ? -1 : a.localeCompare(b));
        return sortedKeys.map(assignee => {
            const items = groups[assignee];
            const checked = items.filter(i => i.checked).length;
            const itemsHTML = items.map(item => `
                <div class="checklist-item ${item.checked ? 'completed' : ''}">
                    <div class="checklist-checkbox ${item.checked ? 'checked' : ''}" onclick="Checklist.toggleItem('${item.catId}','${item.id}')">
                        ${item.checked ? '<span class="material-symbols-rounded">check</span>' : ''}
                    </div>
                    <span class="checklist-item-text">${UI.escapeHtml(item.text)}</span>
                    <span class="checklist-item-cat" style="font-size:0.75rem;opacity:0.6">${item.catIcon} ${UI.escapeHtml(item.catName)}</span>
                    <button class="btn-icon btn-sm" onclick="Checklist.removeItem('${item.catId}','${item.id}')" style="opacity:0.5" title="삭제">
                        <span class="material-symbols-rounded" style="font-size:1rem">close</span>
                    </button>
                </div>
            `).join('');
            return `
                <div class="checklist-category">
                    <div class="checklist-category-header">
                        <div class="checklist-category-title">
                            <span class="material-symbols-rounded">person</span>
                            <span>${assignee === '미배정' ? '미배정' : UI.escapeHtml(assignee)}</span>
                            <span class="checklist-count">${checked}/${items.length}</span>
                        </div>
                    </div>
                    <div class="checklist-items">${itemsHTML}</div>
                </div>`;
        }).join('');
    }

    function setViewMode(mode) {
        _viewMode = mode;
        render();
    }

    function updateProgress(trip) {
        if (!trip) return;
        const progress = Store.getChecklistProgress(trip.id);
        const ring = document.getElementById('checklist-ring-fill');
        const text = document.getElementById('checklist-progress-text');
        const status = document.getElementById('checklist-status');

        if (ring) {
            const offset = 283 - (283 * progress.percent / 100);
            ring.style.strokeDashoffset = offset;
        }
        if (text) text.textContent = progress.percent + '%';
        if (status) status.textContent = `${progress.checked} / ${progress.total} 완료`;

        // 대시보드 통계도 업데이트
        const statEl = document.getElementById('stat-checklist');
        if (statEl) statEl.textContent = progress.percent + '%';
    }

    function toggleItem(catId, itemId) {
        const trip = Store.getCurrentTrip();
        if (trip) {
            const cat = trip.checklist.find(c => c.id === catId);
            const item = cat?.items.find(i => i.id === itemId);
            Store.toggleChecklistItem(trip.id, catId, itemId);
            if (item) Store.addActivity(trip.id, '체크리스트', `"${item.text}" ${item.checked ? '완료' : '해제'}`);
            render();
        }
    }

    function removeItem(catId, itemId) {
        const trip = Store.getCurrentTrip();
        if (trip) {
            Store.removeChecklistItem(trip.id, catId, itemId);
            render();
        }
    }

    function removeCategory(catId) {
        UI.showConfirm('이 카테고리와 포함된 모든 항목을 삭제하시겠습니까?', () => {
            const trip = Store.getCurrentTrip();
            if (trip) {
                Store.removeChecklistCategory(trip.id, catId);
                render();
                UI.showToast('카테고리가 삭제되었습니다', 'success');
            }
        });
    }

    function showAddCategoryModal() {
        const trip = Store.getCurrentTrip();
        if (!trip) { UI.showToast('먼저 여행을 생성해주세요', 'warning'); return; }

        const presets = [
            { name: '필수 준비물', icon: '🎒' },
            { name: '의류', icon: '👕' },
            { name: '세면용품', icon: '🧴' },
            { name: '전자기기', icon: '🔌' },
            { name: '서류/문서', icon: '📄' },
            { name: '약/건강', icon: '💊' },
            { name: '할 일', icon: '📝' },
            { name: '쇼핑 목록', icon: '🛍️' }
        ];

        const presetsHTML = presets.map(p =>
            `<button class="tab-btn" onclick="document.getElementById('cat-name').value='${p.name}';document.getElementById('cat-icon').value='${p.icon}'" style="margin:3px">${p.icon} ${p.name}</button>`
        ).join('');

        UI.showModal('카테고리 추가', `
            <div class="form-group">
                <label class="form-label">빠른 선택</label>
                <div style="display:flex;flex-wrap:wrap;gap:4px">${presetsHTML}</div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">아이콘</label>
                    <input type="text" id="cat-icon" value="📋" style="max-width:60px;text-align:center" />
                </div>
                <div class="form-group">
                    <label class="form-label">카테고리명 *</label>
                    <input type="text" id="cat-name" placeholder="카테고리 이름" />
                </div>
            </div>
        `, `
            <button class="btn-outline" onclick="UI.closeModal()">취소</button>
            <button class="btn-primary" id="btn-save-cat">추가</button>
        `);

        setTimeout(() => {
            document.getElementById('btn-save-cat').onclick = () => {
                const name = document.getElementById('cat-name').value.trim();
                if (!name) { UI.showToast('카테고리명을 입력해주세요', 'warning'); return; }
                Store.addChecklistCategory(trip.id, name, document.getElementById('cat-icon').value.trim() || '📋');
                UI.closeModal();
                render();
                UI.showToast('카테고리가 추가되었습니다', 'success');
            };
        }, 50);
    }

    function showAddItemModal(catId) {
        const trip = Store.getCurrentTrip();
        if (!trip) return;

        const memberOptions = trip.members.map(m =>
            `<option value="${m.name}">${UI.escapeHtml(m.name)}</option>`
        ).join('');

        UI.showModal('항목 추가', `
            <div class="form-group">
                <label class="form-label">항목명 *</label>
                <input type="text" id="cl-item-text" placeholder="예: 여권, 충전기, 수영복" />
            </div>
            <div class="form-group">
                <label class="form-label">담당자 (선택)</label>
                <select id="cl-item-assignee"><option value="">전체</option>${memberOptions}</select>
            </div>
        `, `
            <button class="btn-outline" onclick="UI.closeModal()">취소</button>
            <button class="btn-primary" id="btn-save-cl">추가</button>
        `);

        setTimeout(() => {
            document.getElementById('btn-save-cl').onclick = () => {
                const text = document.getElementById('cl-item-text').value.trim();
                if (!text) { UI.showToast('항목명을 입력해주세요', 'warning'); return; }
                Store.addChecklistItem(trip.id, catId, text, document.getElementById('cl-item-assignee').value);
                UI.closeModal();
                render();
                Store.addActivity(trip.id, '체크리스트 추가', `"${text}" 추가`);
                UI.showToast('항목이 추가되었습니다', 'success');
            };
            document.getElementById('cl-item-text').focus();
        }, 50);
    }

    function showAddModal() {
        showAddCategoryModal();
    }

    return {
        render, toggleItem, removeItem, removeCategory,
        showAddCategoryModal, showAddItemModal, showAddModal, setViewMode
    };
})();

// ========== 여행 메모 ==========
const Journal = (() => {
    function render() {
        const trip = Store.getCurrentTrip();
        const container = document.getElementById('journal-content');
        if (!trip || trip.journals.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📝</div>
                    <h3>작성된 메모가 없습니다</h3>
                    <p>여행 아이디어, 팁, 기록을 남겨보세요</p>
                    <button class="btn-primary" onclick="Journal.showAddModal()">
                        <span class="material-symbols-rounded">add</span> 메모 작성하기
                    </button>
                </div>`;
            return;
        }

        const sorted = [...trip.journals].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        container.innerHTML = '<div class="journal-grid">' + sorted.map(renderCard).join('') + '</div>';
    }

    function renderCard(journal) {
        const tagsHTML = journal.tags.map(t => `<span class="journal-tag">${UI.escapeHtml(t)}</span>`).join('');

        return `
            <div class="journal-card" onclick="Journal.showEditModal('${journal.id}')">
                <div class="journal-card-header">
                    <div class="journal-card-title">${UI.escapeHtml(journal.title)}</div>
                    <span class="journal-card-date">${UI.timeAgo(journal.updatedAt)}</span>
                </div>
                <div class="journal-card-body">${UI.escapeHtml(journal.content)}</div>
                ${tagsHTML ? `<div class="journal-card-tags">${tagsHTML}</div>` : ''}
                <div class="journal-card-footer">
                    <span class="journal-author">
                        <span class="material-symbols-rounded" style="font-size:1rem">person</span>
                        ${UI.escapeHtml(journal.author)}
                    </span>
                    <button class="btn-icon btn-sm" onclick="event.stopPropagation();Journal.remove('${journal.id}')" title="삭제">
                        <span class="material-symbols-rounded">delete_outline</span>
                    </button>
                </div>
            </div>`;
    }

    function showAddModal() {
        const trip = Store.getCurrentTrip();
        if (!trip) { UI.showToast('먼저 여행을 생성해주세요', 'warning'); return; }

        UI.showModal('메모 작성', `
            <div class="form-group">
                <label class="form-label">제목 *</label>
                <input type="text" id="journal-title" placeholder="메모 제목" />
            </div>
            <div class="form-group">
                <label class="form-label">내용</label>
                <textarea id="journal-content" style="min-height:150px" placeholder="여행 아이디어, 팁, 일기 등을 자유롭게 적어보세요"></textarea>
            </div>
            <div class="form-group">
                <label class="form-label">태그 (쉼표로 구분)</label>
                <input type="text" id="journal-tags" placeholder="예: 맛집, 팁, 일기" />
            </div>
        `, `
            <button class="btn-outline" onclick="UI.closeModal()">취소</button>
            <button class="btn-primary" id="btn-save-journal">저장</button>
        `);

        setTimeout(() => {
            document.getElementById('btn-save-journal').onclick = () => {
                const title = document.getElementById('journal-title').value.trim();
                if (!title) { UI.showToast('제목을 입력해주세요', 'warning'); return; }

                const tags = document.getElementById('journal-tags').value.split(',').map(t => t.trim()).filter(Boolean);
                Store.addJournal(trip.id, {
                    title,
                    content: document.getElementById('journal-content').value.trim(),
                    tags,
                    author: Store.getSettings().userName
                });

                UI.closeModal();
                render();
                UI.showToast('메모가 저장되었습니다', 'success');
            };
            document.getElementById('journal-title').focus();
        }, 50);
    }

    function showEditModal(journalId) {
        const trip = Store.getCurrentTrip();
        if (!trip) return;
        const journal = trip.journals.find(j => j.id === journalId);
        if (!journal) return;

        UI.showModal('메모 수정', `
            <div class="form-group">
                <label class="form-label">제목 *</label>
                <input type="text" id="journal-title" value="${UI.escapeHtml(journal.title)}" />
            </div>
            <div class="form-group">
                <label class="form-label">내용</label>
                <textarea id="journal-content" style="min-height:150px">${UI.escapeHtml(journal.content)}</textarea>
            </div>
            <div class="form-group">
                <label class="form-label">태그 (쉼표로 구분)</label>
                <input type="text" id="journal-tags" value="${journal.tags.join(', ')}" />
            </div>
        `, `
            <button class="btn-outline" onclick="UI.closeModal()">취소</button>
            <button class="btn-primary" id="btn-save-journal">저장</button>
        `);

        setTimeout(() => {
            document.getElementById('btn-save-journal').onclick = () => {
                const title = document.getElementById('journal-title').value.trim();
                if (!title) { UI.showToast('제목을 입력해주세요', 'warning'); return; }

                const tags = document.getElementById('journal-tags').value.split(',').map(t => t.trim()).filter(Boolean);
                Store.updateJournal(trip.id, journalId, {
                    title,
                    content: document.getElementById('journal-content').value.trim(),
                    tags
                });

                UI.closeModal();
                render();
                UI.showToast('메모가 수정되었습니다', 'success');
            };
        }, 50);
    }

    function remove(journalId) {
        UI.showConfirm('이 메모를 삭제하시겠습니까?', () => {
            const trip = Store.getCurrentTrip();
            if (trip) {
                Store.removeJournal(trip.id, journalId);
                render();
                UI.showToast('메모가 삭제되었습니다', 'success');
            }
        });
    }

    return { render, showAddModal, showEditModal, remove };
})();

// ========== 멤버 ==========
const Members = (() => {
    function render() {
        const trip = Store.getCurrentTrip();
        const container = document.getElementById('members-content');
        if (!trip || trip.members.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">👥</div>
                    <h3>함께 여행할 멤버를 추가하세요</h3>
                    <p>그룹 여행을 더 쉽게 계획할 수 있습니다</p>
                    <button class="btn-primary" onclick="Members.showAddModal()">
                        <span class="material-symbols-rounded">person_add</span> 멤버 추가하기
                    </button>
                </div>`;
            return;
        }

        const myId = Store.getMyMemberId();
        const activityLog = Store.getActivityLog(trip.id);

        container.innerHTML = `
            <div class="members-grid">${trip.members.map(m => renderCard(m, myId)).join('')}</div>
            <div style="margin-top:24px">
                <h3 style="font-size:1rem;font-weight:700;margin-bottom:12px;display:flex;align-items:center;gap:8px">
                    <span class="material-symbols-rounded">history</span> 활동 내역
                </h3>
                <div class="activity-log">
                    ${activityLog.length === 0
                        ? '<p style="color:var(--text-tertiary);font-size:0.85rem;padding:12px">아직 활동 내역이 없습니다.</p>'
                        : activityLog.slice(0, 30).map(a => `
                            <div class="activity-item">
                                <div class="activity-member">${UI.escapeHtml(a.memberName || '알 수 없음')}</div>
                                <div class="activity-action">${UI.escapeHtml(a.action)}</div>
                                ${a.detail ? `<div class="activity-detail">${UI.escapeHtml(a.detail)}</div>` : ''}
                                <div class="activity-time">${UI.timeAgo(a.timestamp)}</div>
                            </div>
                        `).join('')
                    }
                </div>
            </div>`;
    }

    function renderCard(member, myId) {
        const trip = Store.getCurrentTrip();
        const paid = trip ? trip.expenses.filter(e => e.paidBy === member.id).reduce((s, e) => s + (Number(e.amount) || 0), 0) : 0;
        const isMe = member.id === myId;

        return `
            <div class="member-card ${isMe ? 'member-card-me' : ''}">
                ${isMe ? '<div class="member-me-badge">나</div>' : ''}
                <div class="member-avatar" style="background:${member.color}">${UI.escapeHtml(member.avatar || member.name[0])}</div>
                <div class="member-name">${UI.escapeHtml(member.name)}</div>
                <div class="member-role">${UI.escapeHtml(member.role)}</div>
                <div class="member-stats">
                    <div class="member-stat">
                        <div class="member-stat-value">${UI.formatCurrency(paid)}</div>
                        <div class="member-stat-label">결제 금액</div>
                    </div>
                </div>
                <div style="margin-top:14px;display:flex;gap:8px;justify-content:center">
                    ${isMe ? `<button class="btn-text btn-sm" onclick="Members.showEditModal('${member.id}')">이름 수정</button>` : ''}
                    ${!isMe && member.role !== '관리자' ? `
                        <button class="btn-text btn-sm" onclick="Members.showEditModal('${member.id}')">수정</button>
                        <button class="btn-text btn-sm text-danger" onclick="Members.remove('${member.id}')">삭제</button>
                    ` : ''}
                </div>
            </div>`;
    }

    function showAddModal() {
        const trip = Store.getCurrentTrip();
        if (!trip) { UI.showToast('먼저 여행을 생성해주세요', 'warning'); return; }

        UI.showModal('멤버 추가', `
            <div class="form-group">
                <label class="form-label">이름 *</label>
                <input type="text" id="member-name" placeholder="멤버 이름" />
            </div>
        `, `
            <button class="btn-outline" onclick="UI.closeModal()">취소</button>
            <button class="btn-primary" id="btn-save-member">추가</button>
        `);

        setTimeout(() => {
            document.getElementById('btn-save-member').onclick = () => {
                const name = document.getElementById('member-name').value.trim();
                if (!name) { UI.showToast('이름을 입력해주세요', 'warning'); return; }
                Store.addMember(trip.id, name);
                UI.closeModal();
                render();
                App.updateDashboard();
                UI.showToast(`${name}님이 추가되었습니다`, 'success');
            };
            document.getElementById('member-name').focus();
        }, 50);
    }

    function showEditModal(memberId) {
        const trip = Store.getCurrentTrip();
        if (!trip) return;
        const member = trip.members.find(m => m.id === memberId);
        if (!member) return;

        UI.showModal('멤버 수정', `
            <div class="form-group">
                <label class="form-label">이름 *</label>
                <input type="text" id="member-name" value="${UI.escapeHtml(member.name)}" />
            </div>
        `, `
            <button class="btn-outline" onclick="UI.closeModal()">취소</button>
            <button class="btn-primary" id="btn-save-member">저장</button>
        `);

        setTimeout(() => {
            document.getElementById('btn-save-member').onclick = () => {
                const name = document.getElementById('member-name').value.trim();
                if (!name) { UI.showToast('이름을 입력해주세요', 'warning'); return; }
                Store.updateMember(trip.id, memberId, { name, avatar: name[0] });
                UI.closeModal();
                render();
                UI.showToast('멤버 정보가 수정되었습니다', 'success');
            };
        }, 50);
    }

    function remove(memberId) {
        UI.showConfirm('이 멤버를 삭제하시겠습니까?', () => {
            const trip = Store.getCurrentTrip();
            if (trip) {
                Store.removeMember(trip.id, memberId);
                render();
                App.updateDashboard();
                UI.showToast('멤버가 삭제되었습니다', 'success');
            }
        });
    }

    return { render, showAddModal, showEditModal, remove };
})();

// ========== 즐겨찾기 ==========
const Favorites = (() => {
    function render() {
        const trip = Store.getCurrentTrip();
        const container = document.getElementById('favorites-content');
        if (!trip) return;

        const favs = Store.getFavorites(trip.id);
        if (favs.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">❤️</div>
                    <h3>즐겨찾기가 비어있습니다</h3>
                    <p>일정에서 마음에 드는 장소를 즐겨찾기에 추가해보세요</p>
                </div>`;
            return;
        }

        container.innerHTML = '<div class="favorites-grid">' + favs.map(renderCard).join('') + '</div>';
    }

    function renderCard(item) {
        const catInfo = UI.categoryInfo[item.category] || UI.categoryInfo.place;
        const bgStyle = item.imageUrl
            ? `background-image:url('${item.imageUrl}');background-size:cover;background-position:center`
            : `background:var(--primary-bg);display:flex;align-items:center;justify-content:center;font-size:3rem`;

        return `
            <div class="favorite-card">
                <div class="favorite-image" style="${bgStyle}">
                    ${!item.imageUrl ? catInfo.icon : ''}
                    <div class="favorite-heart"><span class="material-symbols-rounded" style="font-size:1.1rem">favorite</span></div>
                </div>
                <div class="favorite-info">
                    <div class="favorite-name">${UI.escapeHtml(item.title)}</div>
                    <div class="favorite-address">${item.address ? UI.escapeHtml(item.address) : `Day ${item.dayNumber}`}</div>
                </div>
            </div>`;
    }

    return { render };
})();

// ========== 날씨 ==========
const Weather = (() => {
    const API_KEY = 'e49c5d0e650796b2408edf6aa701bb6c';

    function render() {
        // 초기 상태 유지
    }

    function search() {
        const city = document.getElementById('weather-city').value.trim();
        if (!city) { UI.showToast('도시명을 입력해주세요', 'warning'); return; }
        fetchWeather(city);
    }

    async function fetchWeather(city) {
        const container = document.getElementById('weather-content');
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon" style="animation:spin 1.5s linear infinite;font-size:2.5rem">🌀</div>
                <p>날씨 정보를 불러오는 중...</p>
            </div>`;

        try {
            // 현재 날씨
            const currentResp = await fetch(
                `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=metric&lang=kr`
            );
            if (!currentResp.ok) {
                const err = await currentResp.json();
                throw new Error(err.message || '도시를 찾을 수 없습니다');
            }
            const current = await currentResp.json();

            // 5일 예보
            const forecastResp = await fetch(
                `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=metric&lang=kr`
            );
            const forecast = await forecastResp.json();

            renderWeatherData(current, forecast);
        } catch (e) {
            console.error('날씨 API 오류:', e);
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">⚠️</div>
                    <h3>날씨 정보를 가져올 수 없습니다</h3>
                    <p>${UI.escapeHtml(e.message)}</p>
                    <p style="font-size:0.8rem;color:var(--text-tertiary);margin-top:8px">영문 도시명으로 다시 시도해보세요 (예: Tokyo, Paris, Bangkok)</p>
                </div>`;
        }
    }

    function getWeatherEmoji(iconCode) {
        const map = {
            '01d': '☀️', '01n': '🌙',
            '02d': '⛅', '02n': '☁️',
            '03d': '☁️', '03n': '☁️',
            '04d': '🌥️', '04n': '🌥️',
            '09d': '🌧️', '09n': '🌧️',
            '10d': '🌦️', '10n': '🌧️',
            '11d': '⛈️', '11n': '⛈️',
            '13d': '❄️', '13n': '❄️',
            '50d': '🌫️', '50n': '🌫️'
        };
        return map[iconCode] || '🌤️';
    }

    function renderWeatherData(current, forecast) {
        const container = document.getElementById('weather-content');
        const emoji = getWeatherEmoji(current.weather[0].icon);
        const temp = Math.round(current.main.temp);
        const feelsLike = Math.round(current.main.feels_like);
        const desc = current.weather[0].description;
        const cityName = current.name;
        const countryCode = current.sys.country;

        const sunrise = new Date(current.sys.sunrise * 1000);
        const sunset = new Date(current.sys.sunset * 1000);
        const formatTime = (d) => `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;

        // 5일 예보를 일별로 그룹핑 (매일 12:00 데이터 사용)
        const dailyMap = new Map();
        const forecastDays = ['일', '월', '화', '수', '목', '금', '토'];
        if (forecast && forecast.list) {
            forecast.list.forEach(item => {
                const date = item.dt_txt.split(' ')[0];
                const hour = parseInt(item.dt_txt.split(' ')[1].split(':')[0]);
                if (!dailyMap.has(date) || hour === 12) {
                    dailyMap.set(date, item);
                }
            });
        }

        const todayStr = new Date().toISOString().split('T')[0];
        let forecastHTML = '';
        let dayCount = 0;
        dailyMap.forEach((item, date) => {
            if (dayCount >= 7) return;
            const d = new Date(date);
            const dayLabel = date === todayStr ? '오늘' : `${d.getMonth()+1}/${d.getDate()} (${forecastDays[d.getDay()]})`;
            const icon = getWeatherEmoji(item.weather[0].icon);
            const hi = Math.round(item.main.temp_max);
            const lo = Math.round(item.main.temp_min);
            forecastHTML += `
                <div class="forecast-card">
                    <div class="forecast-day">${dayLabel}</div>
                    <div class="forecast-icon">${icon}</div>
                    <div class="forecast-temp">${hi}°</div>
                    <div class="forecast-temp-min">${lo}°</div>
                    <div style="font-size:0.72rem;color:var(--text-tertiary);margin-top:4px">${item.weather[0].description}</div>
                </div>`;
            dayCount++;
        });

        container.innerHTML = `
            <div class="weather-current">
                <div class="weather-icon-large">${emoji}</div>
                <div class="weather-temp">
                    <div class="weather-temp-value">${temp}°</div>
                    <div class="weather-temp-desc">${UI.escapeHtml(cityName)} (${countryCode}) · ${desc}</div>
                </div>
                <div class="weather-details">
                    <div class="weather-detail-item">
                        <span class="material-symbols-rounded">thermostat</span>
                        <span>체감 ${feelsLike}°</span>
                    </div>
                    <div class="weather-detail-item">
                        <span class="material-symbols-rounded">water_drop</span>
                        <span>습도 ${current.main.humidity}%</span>
                    </div>
                    <div class="weather-detail-item">
                        <span class="material-symbols-rounded">air</span>
                        <span>풍속 ${current.wind.speed}m/s</span>
                    </div>
                    <div class="weather-detail-item">
                        <span class="material-symbols-rounded">visibility</span>
                        <span>가시거리 ${(current.visibility / 1000).toFixed(1)}km</span>
                    </div>
                    <div class="weather-detail-item">
                        <span class="material-symbols-rounded">wb_twilight</span>
                        <span>일출 ${formatTime(sunrise)}</span>
                    </div>
                    <div class="weather-detail-item">
                        <span class="material-symbols-rounded">nightlight</span>
                        <span>일몰 ${formatTime(sunset)}</span>
                    </div>
                </div>
            </div>
            <h3 style="margin-bottom:12px;font-size:1rem">📅 5일 예보</h3>
            <div class="weather-forecast">${forecastHTML}</div>
        `;
    }

    return { render, search };
})();

// ========== 지도 ==========
const MapView = (() => {
    let map = null;
    let markers = [];
    let infoWindows = [];
    let directionsRenderer = null;
    let geocoder = null;
    let autocomplete = null;
    let searchMarker = null;
    let currentFilter = 'all';
    let activeTab = 'places';

    const DAY_COLORS = [
        '#4F46E5', '#059669', '#DC2626', '#D97706', '#7C3AED',
        '#EC4899', '#0891B2', '#16A34A', '#B45309', '#6366F1'
    ];

    function render() {
        const trip = Store.getCurrentTrip();

        renderPlacesList();
        renderCandidatesList();

        if (typeof google !== 'undefined' && google.maps) {
            initGoogleMap();
            initAutocomplete();
        } else {
            const container = document.getElementById('google-map');
            container.innerHTML = `
                <div style="text-align:center;padding:40px;color:var(--text-tertiary)">
                    <div style="font-size:4rem;margin-bottom:16px">🗺️</div>
                    <h3 style="color:var(--text-secondary);margin-bottom:8px">Google Maps를 불러오는 중...</h3>
                    <p style="font-size:0.9rem">잠시 후 다시 시도해주세요</p>
                </div>`;
        }

        // 일차 필터 업데이트
        const dayFilter = document.getElementById('map-day-filter');
        if (trip && dayFilter) {
            dayFilter.innerHTML = `<option value="all">전체 일정</option>` +
                trip.days.map(d => `<option value="${d.id}">Day ${d.dayNumber}</option>`).join('');
            dayFilter.value = currentFilter;
        }

        // 탭 상태 복원
        updateTabUI();
    }

    function updateTabUI() {
        document.querySelectorAll('.map-tab').forEach(t => t.classList.toggle('active', t.dataset.mapTab === activeTab));
        document.querySelectorAll('.map-tab-content').forEach(c => c.classList.remove('active'));
        const activeContent = document.getElementById(`map-tab-${activeTab}`);
        if (activeContent) activeContent.classList.add('active');
    }

    function switchTab(tab) {
        activeTab = tab;
        updateTabUI();
    }

    function getAllPlaces(trip, filterDayId) {
        const places = [];
        if (!trip) return places;
        trip.days.forEach(day => {
            if (filterDayId && filterDayId !== 'all' && day.id !== filterDayId) return;
            day.items.forEach(item => {
                if (item.address || item.lat) {
                    places.push({ ...item, dayNumber: day.dayNumber, dayId: day.id });
                }
            });
        });
        return places;
    }

    function renderPlacesList() {
        const trip = Store.getCurrentTrip();
        const list = document.getElementById('map-places-list');
        if (!list) return;

        const places = trip ? getAllPlaces(trip, currentFilter) : [];
        if (places.length === 0) {
            list.innerHTML = '<div class="empty-state-sm"><p>일정에 장소를 추가하면 여기에 표시됩니다</p></div>';
            return;
        }

        list.innerHTML = places.map((p, i) => {
            const color = DAY_COLORS[(p.dayNumber - 1) % DAY_COLORS.length];
            return `
                <div class="map-place-item" onclick="MapView.focusMarker(${i})" style="cursor:pointer">
                    <div class="map-place-marker" style="background:${color}">${i + 1}</div>
                    <div style="flex:1;min-width:0">
                        <div class="map-place-name">${UI.escapeHtml(p.title)}</div>
                        <div class="map-place-address">Day ${p.dayNumber} · ${UI.escapeHtml(p.address || '')}</div>
                    </div>
                </div>`;
        }).join('');
    }

    function renderCandidatesList() {
        const trip = Store.getCurrentTrip();
        const list = document.getElementById('map-candidates-list');
        if (!list) return;

        const candidates = trip ? Store.getCandidates(trip.id) : [];
        if (candidates.length === 0) {
            list.innerHTML = `
                <div class="empty-state-sm">
                    <p>지도에서 장소를 검색하고<br>"후보에 추가"를 눌러보세요</p>
                </div>`;
            return;
        }

        list.innerHTML = candidates.map(c => {
            const catInfo = UI.categoryInfo[c.category] || UI.categoryInfo.place;
            return `
                <div class="map-candidate-item">
                    <div class="map-candidate-info">
                        <div class="map-place-name">${catInfo.icon} ${UI.escapeHtml(c.title)}</div>
                        <div class="map-place-address">${UI.escapeHtml(c.address || '')}</div>
                        ${c.rating ? `<div class="map-candidate-rating">⭐ ${c.rating}</div>` : ''}
                    </div>
                    <div class="map-candidate-actions">
                        <button class="btn-icon-sm" title="일정에 추가" onclick="MapView.addCandidateToItinerary('${c.id}')">
                            <span class="material-symbols-rounded">add_circle</span>
                        </button>
                        <button class="btn-icon-sm" title="지도에서 보기" onclick="MapView.focusCandidate('${c.id}')">
                            <span class="material-symbols-rounded">location_on</span>
                        </button>
                        <button class="btn-icon-sm danger" title="삭제" onclick="MapView.removeCandidate('${c.id}')">
                            <span class="material-symbols-rounded">close</span>
                        </button>
                    </div>
                </div>`;
        }).join('');
    }

    // ===== Google Places Autocomplete =====
    let placesService = null;
    let currentPlaceData = null;

    function initAutocomplete() {
        const input = document.getElementById('map-search-input');
        if (!input || autocomplete) return;

        try {
            autocomplete = new google.maps.places.Autocomplete(input, {
                fields: ['place_id', 'name', 'formatted_address', 'geometry', 'types', 'rating', 'photos']
            });
            if (map) autocomplete.bindTo('bounds', map);

            autocomplete.addListener('place_changed', () => {
                const place = autocomplete.getPlace();
                if (!place || !place.geometry) {
                    // 엔터만 친 경우 → textSearch
                    const q = input.value.trim();
                    if (q) searchPlace(q);
                    return;
                }
                showPlaceCard(place);
                input.blur();
            });
        } catch (err) {
            console.warn('Autocomplete 초기화 실패:', err);
        }

        // Enter 키 → textSearch
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                // pac-container 숨기기
                document.querySelectorAll('.pac-container').forEach(el => el.style.display = 'none');
                const q = input.value.trim();
                if (q) searchPlace(q);
                input.blur();
            }
        });

        // ESC → 닫기
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                input.value = '';
                input.blur();
                closePlaceCard();
            }
        });

        // PlacesService
        if (!placesService && map) {
            try { placesService = new google.maps.places.PlacesService(map); } catch (e) {}
        }

        // 카드 버튼 바인딩
        document.getElementById('btn-place-card-close').onclick = closePlaceCard;
        document.getElementById('btn-card-add-itinerary').onclick = () => {
            if (currentPlaceData) showAddToItineraryModal(currentPlaceData);
        };
        document.getElementById('btn-card-add-candidate').onclick = () => {
            const trip = Store.getCurrentTrip();
            if (!trip) { UI.showToast('여행을 먼저 생성해주세요', 'warning'); return; }
            if (currentPlaceData) {
                Store.addCandidate(trip.id, currentPlaceData);
                Store.addActivity(trip.id, '후보 추가', `"${currentPlaceData.title}" 후보 추가`);
                renderCandidatesList();
                switchTab('candidates');
                UI.showToast(`"${currentPlaceData.title}" 후보에 추가됨`, 'success');
            }
        };
    }

    function searchPlace(query) {
        if (!query || !map) return;

        const resultsEl = document.getElementById('map-search-results');

        if (placesService) {
            placesService.textSearch({
                query: query,
                location: map.getCenter(),
                radius: 50000
            }, (results, status) => {
                if (status === google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
                    if (results.length === 1) {
                        showPlaceCard(results[0]);
                        closeSearchResults();
                    } else {
                        showSearchResults(results);
                    }
                } else {
                    geocodeFallback(query);
                }
            });
        } else {
            geocodeFallback(query);
        }
    }

    function showSearchResults(results) {
        const resultsEl = document.getElementById('map-search-results');
        if (!resultsEl) return;

        // 검색 마커 제거 & 결과 마커 배열
        if (searchMarker) { searchMarker.setMap(null); searchMarker = null; }
        clearSearchResultMarkers();

        const bounds = new google.maps.LatLngBounds();
        const maxResults = Math.min(results.length, 20);

        let html = `<div class="search-results-header">
            <span>검색 결과 ${results.length}건</span>
            <button class="search-results-close" onclick="MapView.closeSearchResults()">
                <span class="material-symbols-rounded">close</span>
            </button>
        </div><div class="search-results-list">`;

        for (let i = 0; i < maxResults; i++) {
            const place = results[i];
            const lat = place.geometry.location.lat();
            const lng = place.geometry.location.lng();
            const photoUrl = place.photos && place.photos[0]
                ? place.photos[0].getUrl({ maxWidth: 60, maxHeight: 60 })
                : '';
            const rating = place.rating ? `⭐ ${place.rating}` : '';
            const addr = place.formatted_address || place.vicinity || '';

            // 마커 추가
            const marker = new google.maps.Marker({
                position: { lat, lng },
                map: map,
                label: { text: String(i + 1), color: '#fff', fontWeight: 'bold', fontSize: '12px' },
                title: place.name,
                zIndex: 100 + i
            });
            marker.addListener('click', () => {
                showPlaceCard(place);
                closeSearchResults();
            });
            _searchResultMarkers.push(marker);
            bounds.extend({ lat, lng });

            html += `<div class="search-result-item" data-idx="${i}" onclick="MapView.selectSearchResult(${i})">
                <div class="search-result-num">${i + 1}</div>
                ${photoUrl ? `<img class="search-result-photo" src="${photoUrl}" alt="" loading="lazy" onerror="this.style.display='none'">` : '<div class="search-result-photo-empty"><span class="material-symbols-rounded">location_on</span></div>'}
                <div class="search-result-info">
                    <div class="search-result-name">${UI.escapeHtml(place.name)}</div>
                    <div class="search-result-meta">
                        ${rating ? `<span class="search-result-rating">${rating}</span>` : ''}
                        <span class="search-result-addr">${UI.escapeHtml(addr)}</span>
                    </div>
                </div>
            </div>`;
        }

        html += '</div>';
        resultsEl.innerHTML = html;
        resultsEl.classList.add('show');
        _searchResults = results;

        // 지도를 결과 범위에 맞추기
        if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 60 });
    }

    let _searchResults = [];
    let _searchResultMarkers = [];

    function clearSearchResultMarkers() {
        _searchResultMarkers.forEach(m => m.setMap(null));
        _searchResultMarkers = [];
    }

    function selectSearchResult(idx) {
        if (_searchResults[idx]) {
            showPlaceCard(_searchResults[idx]);
            closeSearchResults();
        }
    }

    function closeSearchResults() {
        const el = document.getElementById('map-search-results');
        if (el) { el.classList.remove('show'); el.innerHTML = ''; }
        clearSearchResultMarkers();
        _searchResults = [];
    }

    function geocodeFallback(query) {
        if (!geocoder) geocoder = new google.maps.Geocoder();
        geocoder.geocode({ address: query }, (results, status) => {
            if (status === 'OK' && results[0]) {
                showPlaceCard({
                    name: query,
                    formatted_address: results[0].formatted_address,
                    geometry: { location: results[0].geometry.location },
                    place_id: results[0].place_id,
                    types: results[0].types || [],
                    rating: null, photos: null
                });
            } else {
                UI.showToast('장소를 찾을 수 없습니다', 'warning');
            }
        });
    }

    function showPlaceCard(place) {
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();

        // 지도 이동
        map.panTo({ lat, lng });
        map.setZoom(16);

        // 기존 검색 마커 제거 → 새 마커
        if (searchMarker) searchMarker.setMap(null);
        searchMarker = new google.maps.Marker({
            position: { lat, lng },
            map: map,
            title: place.name,
            animation: google.maps.Animation.DROP,
            zIndex: 9999
        });

        // 카테고리 자동 감지
        const types = place.types || [];
        let autoCategory = 'place';
        if (types.some(t => ['restaurant', 'food', 'cafe', 'bakery', 'bar', 'meal_delivery', 'meal_takeaway'].includes(t))) autoCategory = 'food';
        else if (types.some(t => ['lodging', 'hotel'].includes(t))) autoCategory = 'accommodation';
        else if (types.some(t => ['shopping_mall', 'store', 'clothing_store', 'shoe_store', 'jewelry_store'].includes(t))) autoCategory = 'shopping';
        else if (types.some(t => ['tourist_attraction', 'museum', 'amusement_park', 'aquarium', 'zoo', 'art_gallery', 'stadium', 'park'].includes(t))) autoCategory = 'activity';

        // 사진
        let photoUrl = '';
        if (place.photos && place.photos.length > 0) {
            try { photoUrl = place.photos[0].getUrl({ maxWidth: 400 }); } catch (e) {}
        }

        // 카드 데이터 저장
        currentPlaceData = {
            title: place.name || '',
            address: place.formatted_address || '',
            lat, lng, category: autoCategory,
            imageUrl: photoUrl,
            placeId: place.place_id || '',
            rating: place.rating || null
        };

        // 카드 UI 업데이트
        const card = document.getElementById('map-place-card');
        const photoDiv = document.getElementById('map-place-card-photo');
        const nameEl = document.getElementById('map-place-card-name');
        const ratingEl = document.getElementById('map-place-card-rating');
        const addrEl = document.getElementById('map-place-card-address');
        const gmapsLink = document.getElementById('btn-card-gmaps');

        if (photoUrl) {
            photoDiv.style.backgroundImage = `url('${photoUrl}')`;
            photoDiv.classList.remove('hidden');
        } else {
            photoDiv.classList.add('hidden');
        }

        nameEl.textContent = place.name || '';
        ratingEl.innerHTML = place.rating ? `⭐ ${place.rating}` : '';
        addrEl.textContent = place.formatted_address || '';
        gmapsLink.href = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

        card.classList.add('show');
    }

    function closePlaceCard() {
        const card = document.getElementById('map-place-card');
        card.classList.remove('show');
        if (searchMarker) { searchMarker.setMap(null); searchMarker = null; }
        currentPlaceData = null;
    }

    // ===== 일정에 추가 모달 =====
    function showAddToItineraryModal(placeData) {
        const trip = Store.getCurrentTrip();
        if (!trip || trip.days.length === 0) {
            UI.showToast('먼저 일정(Day)을 추가해주세요', 'warning');
            return;
        }

        const catOptions = Object.entries(UI.categoryInfo).map(([key, info]) =>
            `<option value="${key}" ${key === placeData.category ? 'selected' : ''}>${info.icon} ${info.label}</option>`
        ).join('');

        const dayOptions = trip.days.map(d =>
            `<option value="${d.id}">Day ${d.dayNumber} ${d.date ? '(' + d.date + ')' : ''}</option>`
        ).join('');

        UI.showModal('📍 일정에 장소 추가', `
            <div class="form-group">
                <label>장소명</label>
                <input type="text" id="map-add-title" value="${UI.escapeHtml(placeData.title)}" class="form-input">
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>일차 선택</label>
                    <select id="map-add-day" class="form-input">${dayOptions}</select>
                </div>
                <div class="form-group">
                    <label>카테고리</label>
                    <select id="map-add-category" class="form-input">${catOptions}</select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>시작 시간</label>
                    <input type="time" id="map-add-start" class="form-input">
                </div>
                <div class="form-group">
                    <label>종료 시간</label>
                    <input type="time" id="map-add-end" class="form-input">
                </div>
            </div>
            <div class="form-group">
                <label>주소</label>
                <input type="text" id="map-add-address" value="${UI.escapeHtml(placeData.address)}" class="form-input" readonly>
            </div>
            <div class="form-group">
                <label>예상 비용</label>
                <input type="number" id="map-add-cost" class="form-input" placeholder="0">
            </div>
            <div class="form-group">
                <label>메모</label>
                <textarea id="map-add-notes" class="form-input" rows="2" placeholder="메모를 입력하세요"></textarea>
            </div>
            <div class="modal-actions">
                <button class="btn-outline" onclick="UI.closeModal()">취소</button>
                <button class="btn-primary" id="btn-map-add-confirm">추가하기</button>
            </div>
        `);

        document.getElementById('btn-map-add-confirm').addEventListener('click', () => {
            const dayId = document.getElementById('map-add-day').value;
            const title = document.getElementById('map-add-title').value.trim();
            if (!title) { UI.showToast('장소명을 입력해주세요', 'warning'); return; }

            Store.addItineraryItem(trip.id, dayId, {
                title,
                category: document.getElementById('map-add-category').value,
                startTime: document.getElementById('map-add-start').value,
                endTime: document.getElementById('map-add-end').value,
                address: document.getElementById('map-add-address').value,
                lat: placeData.lat,
                lng: placeData.lng,
                placeId: placeData.placeId || null,
                imageUrl: placeData.imageUrl || '',
                cost: parseFloat(document.getElementById('map-add-cost').value) || 0,
                notes: document.getElementById('map-add-notes').value.trim()
            });

            UI.closeModal();
            UI.showToast(`"${title}" 일정에 추가됨`, 'success');
            render();
        });
    }

    // ===== 후보 장소 관리 =====
    function addCandidateToItinerary(candidateId) {
        const trip = Store.getCurrentTrip();
        if (!trip) return;
        const candidate = (trip.candidates || []).find(c => c.id === candidateId);
        if (!candidate) return;

        showAddToItineraryModal({
            title: candidate.title,
            address: candidate.address,
            lat: candidate.lat,
            lng: candidate.lng,
            category: candidate.category,
            imageUrl: candidate.imageUrl,
            placeId: candidate.placeId,
            rating: candidate.rating
        });
    }

    function focusCandidate(candidateId) {
        const trip = Store.getCurrentTrip();
        if (!trip) return;
        const candidate = (trip.candidates || []).find(c => c.id === candidateId);
        if (!candidate || !candidate.lat || !candidate.lng) {
            UI.showToast('좌표 정보가 없습니다', 'warning');
            return;
        }

        map.panTo({ lat: candidate.lat, lng: candidate.lng });
        map.setZoom(16);

        if (searchMarker) searchMarker.setMap(null);
        searchMarker = new google.maps.Marker({
            position: { lat: candidate.lat, lng: candidate.lng },
            map: map,
            title: candidate.title,
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                fillColor: '#D97706',
                fillOpacity: 1,
                strokeColor: 'white',
                strokeWeight: 3,
                scale: 16,
                labelOrigin: new google.maps.Point(0, 0)
            },
            label: { text: (UI.categoryInfo[candidate.category] || UI.categoryInfo.place).icon[0], color: 'white', fontSize: '10px' },
            animation: google.maps.Animation.BOUNCE
        });
        setTimeout(() => { if (searchMarker) searchMarker.setAnimation(null); }, 1400);
    }

    function removeCandidate(candidateId) {
        const trip = Store.getCurrentTrip();
        if (!trip) return;
        Store.removeCandidate(trip.id, candidateId);
        renderCandidatesList();
        UI.showToast('후보에서 삭제됨', 'info');
    }

    function initGoogleMap() {
        const container = document.getElementById('google-map');
        const trip = Store.getCurrentTrip();

        if (!geocoder) geocoder = new google.maps.Geocoder();

        if (!map) {
            map = new google.maps.Map(container, {
                center: { lat: 37.5665, lng: 126.9780 },
                zoom: 12,
                mapTypeControl: true,
                mapTypeControlOptions: {
                    style: google.maps.MapTypeControlStyle.DROPDOWN_MENU,
                    position: google.maps.ControlPosition.TOP_RIGHT
                },
                fullscreenControl: true,
                streetViewControl: false,
                styles: [
                    { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
                    { featureType: 'transit', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] }
                ]
            });

            // 지도 클릭 → 장소 카드 표시
            map.addListener('click', (e) => {
                if (!e.latLng) return;
                const lat = e.latLng.lat();
                const lng = e.latLng.lng();

                // placeId가 있으면 (POI 클릭) Places 상세 조회
                if (e.placeId && placesService) {
                    e.stop(); // 기본 InfoWindow 방지
                    placesService.getDetails({
                        placeId: e.placeId,
                        fields: ['place_id', 'name', 'formatted_address', 'geometry', 'types', 'rating', 'photos']
                    }, (detail, status) => {
                        if (status === google.maps.places.PlacesServiceStatus.OK && detail) {
                            showPlaceCard(detail);
                        }
                    });
                } else {
                    // 빈 곳 클릭 → 역지오코딩
                    if (!geocoder) geocoder = new google.maps.Geocoder();
                    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
                        if (status === 'OK' && results[0]) {
                            showPlaceCard({
                                name: results[0].formatted_address.split(',')[0],
                                formatted_address: results[0].formatted_address,
                                geometry: { location: e.latLng },
                                place_id: results[0].place_id,
                                types: results[0].types || [],
                                rating: null, photos: null
                            });
                        }
                    });
                }
            });
        }

        // 기존 마커/경로 초기화
        markers.forEach(m => m.setMap(null));
        markers = [];
        infoWindows.forEach(iw => iw.close());
        infoWindows = [];
        if (directionsRenderer) {
            directionsRenderer.setMap(null);
            directionsRenderer = null;
        }

        if (!trip) return;

        const places = getAllPlaces(trip, currentFilter);
        const bounds = new google.maps.LatLngBounds();
        let geocodeQueue = [];

        places.forEach((place, i) => {
            const color = DAY_COLORS[(place.dayNumber - 1) % DAY_COLORS.length];
            const catInfo = UI.categoryInfo[place.category] || UI.categoryInfo.place;

            if (place.lat && place.lng) {
                addMarker(place, i, color, catInfo, bounds);
            } else if (place.address) {
                geocodeQueue.push({ place, index: i, color, catInfo });
            }
        });

        // 주소만 있는 장소 지오코딩
        geocodeQueue.forEach(({ place, index, color, catInfo }, qi) => {
            setTimeout(() => {
                geocoder.geocode({ address: place.address }, (results, status) => {
                    if (status === 'OK' && results[0]) {
                        const loc = results[0].geometry.location;
                        place.lat = loc.lat();
                        place.lng = loc.lng();
                        addMarker(place, index, color, catInfo, bounds);
                        if (bounds.getNorthEast() && bounds.getSouthWest()) {
                            map.fitBounds(bounds, { padding: 60 });
                        }
                    }
                });
            }, qi * 200);
        });

        if (markers.length > 0) {
            if (markers.length === 1) {
                map.setCenter(markers[0].getPosition());
                map.setZoom(15);
            } else {
                map.fitBounds(bounds, { padding: 60 });
            }
        }
    }

    function addMarker(place, index, color, catInfo, bounds) {
        const pos = { lat: place.lat, lng: place.lng };

        const marker = new google.maps.Marker({
            position: pos,
            map: map,
            title: place.title,
            label: {
                text: String(index + 1),
                color: 'white',
                fontWeight: 'bold',
                fontSize: '12px'
            },
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                fillColor: color,
                fillOpacity: 1,
                strokeColor: 'white',
                strokeWeight: 2,
                scale: 16,
                labelOrigin: new google.maps.Point(0, 0)
            },
            animation: google.maps.Animation.DROP
        });

        const infoContent = `
            <div style="font-family:'Noto Sans KR',sans-serif;max-width:250px;padding:4px">
                <div style="font-weight:700;font-size:14px;margin-bottom:6px">${catInfo.icon} ${UI.escapeHtml(place.title)}</div>
                <div style="font-size:12px;color:#666;margin-bottom:4px">📍 Day ${place.dayNumber}${place.startTime ? ' · ' + place.startTime : ''}</div>
                ${place.address ? `<div style="font-size:12px;color:#888;margin-bottom:4px">${UI.escapeHtml(place.address)}</div>` : ''}
                ${place.notes ? `<div style="font-size:12px;color:#555;margin-top:6px;border-top:1px solid #eee;padding-top:6px">${UI.escapeHtml(place.notes)}</div>` : ''}
                ${place.cost ? `<div style="font-size:12px;font-weight:600;color:#4F46E5;margin-top:4px">${UI.formatCurrency(place.cost)}</div>` : ''}
                <a href="https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}" target="_blank" rel="noopener"
                   style="display:inline-block;margin-top:8px;font-size:11px;color:#1a73e8;text-decoration:none">
                    Google Maps에서 보기 →
                </a>
            </div>`;

        const infoWindow = new google.maps.InfoWindow({ content: infoContent });
        infoWindows.push(infoWindow);

        marker.addListener('click', () => {
            infoWindows.forEach(iw => iw.close());
            infoWindow.open(map, marker);
        });

        markers.push(marker);
        bounds.extend(pos);
    }

    function focusMarker(index) {
        if (markers[index]) {
            map.panTo(markers[index].getPosition());
            map.setZoom(16);
            infoWindows.forEach(iw => iw.close());
            if (infoWindows[index]) {
                infoWindows[index].open(map, markers[index]);
            }
            markers[index].setAnimation(google.maps.Animation.BOUNCE);
            setTimeout(() => markers[index].setAnimation(null), 1400);
        }
    }

    function showRoute() {
        if (!map || markers.length < 2) {
            UI.showToast('경로를 표시하려면 2개 이상의 장소가 필요합니다', 'warning');
            return;
        }

        const trip = Store.getCurrentTrip();
        if (!trip) return;

        const places = getAllPlaces(trip, currentFilter).filter(p => p.lat && p.lng);
        if (places.length < 2) {
            UI.showToast('좌표가 있는 장소가 2개 이상 필요합니다', 'warning');
            return;
        }

        // 기존 렌더러 정리
        if (directionsRenderer) directionsRenderer.setMap(null);
        if (!window._routeRenderers) window._routeRenderers = [];
        window._routeRenderers.forEach(r => r.setMap(null));
        window._routeRenderers = [];

        const directionsService = new google.maps.DirectionsService();
        const polyColor = getComputedStyle(document.body).getPropertyValue('--primary').trim() || '#4F46E5';

        // 구간별로 개별 경로 요청 (실패 구간은 건너뜀)
        let totalDist = 0, totalDur = 0;
        let successCount = 0, failCount = 0;
        let completed = 0;
        const totalPairs = places.length - 1;

        for (let i = 0; i < totalPairs; i++) {
            const origin = { lat: places[i].lat, lng: places[i].lng };
            const destination = { lat: places[i + 1].lat, lng: places[i + 1].lng };

            directionsService.route({
                origin,
                destination,
                travelMode: google.maps.TravelMode.DRIVING
            }, (result, status) => {
                completed++;

                if (status === 'OK' && result.routes[0]) {
                    const renderer = new google.maps.DirectionsRenderer({
                        map: map,
                        suppressMarkers: true,
                        polylineOptions: {
                            strokeColor: polyColor,
                            strokeOpacity: 0.8,
                            strokeWeight: 4
                        },
                        preserveViewport: true
                    });
                    renderer.setDirections(result);
                    window._routeRenderers.push(renderer);

                    const leg = result.routes[0].legs[0];
                    totalDist += leg.distance.value;
                    totalDur += leg.duration.value;
                    successCount++;
                } else {
                    failCount++;
                }

                // 모든 구간 완료
                if (completed === totalPairs) {
                    if (successCount === 0) {
                        UI.showToast('차량 경로를 찾을 수 없는 구간입니다 (해외/섬 등)', 'warning');
                        // 경로가 없어도 지도는 모든 장소 범위로 조정
                        const bounds = new google.maps.LatLngBounds();
                        places.forEach(p => bounds.extend({ lat: p.lat, lng: p.lng }));
                        map.fitBounds(bounds);
                        return;
                    }
                    const distKm = (totalDist / 1000).toFixed(1);
                    const durHrs = Math.floor(totalDur / 3600);
                    const durMin = Math.round((totalDur % 3600) / 60);
                    let msg = `경로: 총 ${distKm}km, 예상 ${durHrs > 0 ? durHrs + '시간 ' : ''}${durMin}분`;
                    if (failCount > 0) {
                        msg += ` (${failCount}개 구간 경로 없음)`;
                    }
                    UI.showToast(msg, failCount > 0 ? 'warning' : 'success', 5000);

                    // 전체 경로가 보이도록 지도 조정
                    const bounds = new google.maps.LatLngBounds();
                    places.forEach(p => bounds.extend({ lat: p.lat, lng: p.lng }));
                    map.fitBounds(bounds);
                }
            });
        }
    }

    function setFilter(filterVal) {
        currentFilter = filterVal;
        render();
    }

    return { render, initGoogleMap, focusMarker, showRoute, setFilter, switchTab,
             searchPlace, addCandidateToItinerary, focusCandidate, removeCandidate,
             selectSearchResult, closeSearchResults };
})();
