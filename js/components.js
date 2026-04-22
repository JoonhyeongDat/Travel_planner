/* ===================================
   트래블메이트 - UI 컴포넌트
   모달, 토스트, 렌더링 헬퍼
   =================================== */

const UI = (() => {

    // ---- 모달 ----
    function showModal(title, bodyHTML, footerHTML, options = {}) {
        const overlay = document.getElementById('modal-overlay');
        const container = document.getElementById('modal-container');
        const titleEl = document.getElementById('modal-title');
        const bodyEl = document.getElementById('modal-body');
        const footerEl = document.getElementById('modal-footer');

        titleEl.textContent = title;
        bodyEl.innerHTML = bodyHTML;
        footerEl.innerHTML = footerHTML || '';
        if (options.wide) container.style.maxWidth = '800px';
        else container.style.maxWidth = '600px';

        overlay.style.display = 'flex';
        document.body.style.overflow = 'hidden';

        // 이벤트 바인딩
        document.getElementById('modal-close').onclick = closeModal;
        overlay.onclick = (e) => {
            if (e.target === overlay) closeModal();
        };

        if (options.onOpen) {
            setTimeout(() => options.onOpen(), 50);
        }
    }

    function closeModal() {
        const overlay = document.getElementById('modal-overlay');
        overlay.style.display = 'none';
        document.body.style.overflow = '';
    }

    // ---- 토스트 ----
    function showToast(message, type = 'info', duration = 3000) {
        const container = document.getElementById('toast-container');
        const icons = {
            info: 'info',
            success: 'check_circle',
            warning: 'warning',
            error: 'error'
        };
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <span class="material-symbols-rounded">${icons[type] || 'info'}</span>
            <span>${escapeHtml(message)}</span>
        `;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100px)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    // ---- 확인 다이얼로그 ----
    function showConfirm(message, onConfirm) {
        showModal('확인', `
            <p style="font-size: 1rem; line-height: 1.6; padding: 8px 0;">${escapeHtml(message)}</p>
        `, `
            <button class="btn-outline" onclick="UI.closeModal()">취소</button>
            <button class="btn-danger" id="confirm-btn">확인</button>
        `);
        setTimeout(() => {
            document.getElementById('confirm-btn').onclick = () => {
                closeModal();
                onConfirm();
            };
        }, 50);
    }

    // ---- HTML 이스케이프 ----
    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ---- 날짜 포매팅 ----
    function formatDate(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        const days = ['일', '월', '화', '수', '목', '금', '토'];
        return `${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
    }

    function formatDateShort(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return `${d.getMonth() + 1}/${d.getDate()}`;
    }

    function formatCurrency(amount) {
        const settings = Store.getSettings();
        const num = Number(amount) || 0;
        return settings.currencySymbol + num.toLocaleString('ko-KR');
    }

    function daysUntil(dateStr) {
        if (!dateStr) return null;
        const target = new Date(dateStr);
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        target.setHours(0, 0, 0, 0);
        return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
    }

    function timeAgo(dateStr) {
        const now = new Date();
        const d = new Date(dateStr);
        const diff = now - d;
        const minutes = Math.floor(diff / 60000);
        if (minutes < 1) return '방금 전';
        if (minutes < 60) return `${minutes}분 전`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}시간 전`;
        const days = Math.floor(hours / 24);
        if (days < 7) return `${days}일 전`;
        return formatDate(dateStr);
    }

    // ---- 카테고리 헬퍼 ----
    const categoryInfo = {
        place: { icon: '📍', label: '관광지', color: '#4F46E5' },
        food: { icon: '🍽️', label: '식당', color: '#059669' },
        activity: { icon: '🎯', label: '액티비티', color: '#D97706' },
        transport: { icon: '🚗', label: '교통', color: '#0891B2' },
        accommodation: { icon: '🏨', label: '숙소', color: '#7C3AED' },
        shopping: { icon: '🛍️', label: '쇼핑', color: '#EC4899' },
        cafe: { icon: '☕', label: '카페', color: '#B45309' },
        entertainment: { icon: '🎭', label: '공연/문화', color: '#DC2626' }
    };

    const reservationTypeInfo = {
        flight: { icon: '✈️', label: '항공' },
        train: { icon: '🚄', label: '기차' },
        hotel: { icon: '🏨', label: '숙소' },
        restaurant: { icon: '🍽️', label: '식당' },
        ticket: { icon: '🎫', label: '티켓' },
        transport: { icon: '🚗', label: '교통' },
        other: { icon: '📋', label: '기타' }
    };

    const expenseCategoryInfo = {
        food: { icon: '🍽️', label: '식비', color: '#059669' },
        transport: { icon: '🚗', label: '교통비', color: '#0891B2' },
        accommodation: { icon: '🏨', label: '숙박비', color: '#7C3AED' },
        activity: { icon: '🎯', label: '관광/체험', color: '#D97706' },
        shopping: { icon: '🛍️', label: '쇼핑', color: '#EC4899' },
        entertainment: { icon: '🎭', label: '문화/공연', color: '#DC2626' },
        etc: { icon: '📦', label: '기타', color: '#6B7280' }
    };

    // ---- 이미지 자동 로드 (Unsplash) ----
    function getPlaceImage(placeName, category) {
        if (!placeName) return '';
        const query = encodeURIComponent(placeName);
        // Unsplash Source (free, no API key required)
        return `https://source.unsplash.com/400x300/?${query},travel`;
    }

    // ---- Google Maps URL 파싱 ----
    function parseGoogleMapsUrl(url) {
        if (!url) return null;
        url = url.trim();

        const result = { title: '', address: '', lat: null, lng: null, placeId: '' };

        try {
            // 좌표 추출: /@lat,lng 패턴
            const coordMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
            if (coordMatch) {
                result.lat = parseFloat(coordMatch[1]);
                result.lng = parseFloat(coordMatch[2]);
            }

            // ?q=lat,lng 패턴
            if (!result.lat) {
                const qMatch = url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
                if (qMatch) {
                    result.lat = parseFloat(qMatch[1]);
                    result.lng = parseFloat(qMatch[2]);
                }
            }

            // Place ID 추출
            const pidMatch = url.match(/place_id[=:]([\w-]+)/);
            if (pidMatch) result.placeId = pidMatch[1];

            // 장소명 추출: /place/장소명/ 패턴
            const placeMatch = url.match(/\/place\/([^/@]+)/);
            if (placeMatch) {
                result.title = decodeURIComponent(placeMatch[1].replace(/\+/g, ' '));
            }

            // /search/ 패턴
            if (!result.title) {
                const searchMatch = url.match(/\/search\/([^/@?]+)/);
                if (searchMatch) {
                    result.title = decodeURIComponent(searchMatch[1].replace(/\+/g, ' '));
                }
            }

            // ?q=텍스트 패턴 (좌표가 아닌 경우)
            if (!result.title) {
                const qTextMatch = url.match(/[?&]q=([^&]+)/);
                if (qTextMatch) {
                    const val = decodeURIComponent(qTextMatch[1].replace(/\+/g, ' '));
                    if (!/^-?\d+\.\d+,-?\d+\.\d+$/.test(val)) {
                        result.title = val;
                    }
                }
            }

            // data 파라미터에서 추가 정보 추출
            const dataMatch = url.match(/!3s([^!]+)/);
            if (dataMatch && !result.placeId) {
                result.placeId = decodeURIComponent(dataMatch[1]);
            }

            // 주소 추정: 장소명 뒤의 경로에서 추출 시도
            const addrMatch = url.match(/\/place\/[^/]+\/([^/@]+)/);
            if (addrMatch) {
                const addr = decodeURIComponent(addrMatch[1].replace(/\+/g, ' '));
                if (addr && addr !== result.title) {
                    result.address = addr;
                }
            }

            // 유효한 Google Maps 링크인지 확인
            const isGoogleMaps = /google\.com\/maps|maps\.google|maps\.app\.goo\.gl|goo\.gl\/maps/i.test(url);
            if (!isGoogleMaps) return null;

            return result;
        } catch (e) {
            console.error('Google Maps URL 파싱 실패:', e);
            return null;
        }
    }

    // Google Maps 좌표로 역지오코딩 (Nominatim - 무료)
    async function reverseGeocode(lat, lng) {
        try {
            const resp = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=ko`);
            if (!resp.ok) return null;
            const data = await resp.json();
            return {
                address: data.display_name || '',
                name: data.name || data.address?.tourism || data.address?.amenity || data.address?.building || '',
                road: data.address?.road || '',
                city: data.address?.city || data.address?.town || data.address?.village || '',
                country: data.address?.country || ''
            };
        } catch (e) {
            console.error('역지오코딩 실패:', e);
            return null;
        }
    }

    // ---- 드래그 앤 드롭 헬퍼 ----
    let draggedItem = null;
    let draggedDayId = null;
    let draggedCandidateId = null; // 후보 드래그용

    function initDragAndDrop(container) {
        container.addEventListener('dragstart', handleDragStart);
        container.addEventListener('dragend', handleDragEnd);
        container.addEventListener('dragover', handleDragOver);
        container.addEventListener('drop', handleDrop);
        container.addEventListener('dragleave', handleDragLeave);
    }

    function handleDragStart(e) {
        // 후보 아이템 드래그
        const candidateItem = e.target.closest('[data-candidate-id]');
        if (candidateItem) {
            draggedCandidateId = candidateItem.dataset.candidateId;
            draggedItem = null;
            draggedDayId = null;
            candidateItem.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', 'candidate:' + draggedCandidateId);
            return;
        }

        // 일정 아이템 드래그
        const item = e.target.closest('[data-item-id]');
        const dayCard = e.target.closest('[data-day-id]');
        if (!item || !dayCard) return;

        draggedItem = item.dataset.itemId;
        draggedDayId = dayCard.dataset.dayId;
        draggedCandidateId = null;
        item.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', draggedItem);
    }

    function handleDragEnd(e) {
        const item = e.target.closest('[data-item-id]');
        if (item) item.classList.remove('dragging');
        const cand = e.target.closest('[data-candidate-id]');
        if (cand) cand.classList.remove('dragging');
        document.querySelectorAll('.drag-over, .drag-over-item, .drag-over-candidates').forEach(el => {
            el.classList.remove('drag-over', 'drag-over-item', 'drag-over-candidates');
        });
        draggedItem = null;
        draggedDayId = null;
        draggedCandidateId = null;
    }

    function handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        // 후보 사이드바 위에 드래그
        const candidatesSidebar = e.target.closest('.itinerary-candidates-sidebar');
        if (candidatesSidebar && draggedItem) {
            candidatesSidebar.classList.add('drag-over-candidates');
        }

        const dayItems = e.target.closest('.day-items');
        if (dayItems) {
            dayItems.classList.add('drag-over');
        }

        const overItem = e.target.closest('[data-item-id]');
        if (overItem && overItem.dataset.itemId !== draggedItem) {
            document.querySelectorAll('.drag-over-item').forEach(el => el.classList.remove('drag-over-item'));
            overItem.classList.add('drag-over-item');
        }
    }

    function handleDragLeave(e) {
        const dayItems = e.target.closest('.day-items');
        if (dayItems && !dayItems.contains(e.relatedTarget)) {
            dayItems.classList.remove('drag-over');
        }
        const sidebar = e.target.closest('.itinerary-candidates-sidebar');
        if (sidebar && !sidebar.contains(e.relatedTarget)) {
            sidebar.classList.remove('drag-over-candidates');
        }
    }

    function handleDrop(e) {
        e.preventDefault();
        document.querySelectorAll('.drag-over, .drag-over-item, .drag-over-candidates').forEach(el => {
            el.classList.remove('drag-over', 'drag-over-item', 'drag-over-candidates');
        });

        const trip = Store.getCurrentTrip();
        if (!trip) return;

        // Case 1: 일정 아이템 → 후보 사이드바로 드롭
        const candidatesSidebar = e.target.closest('.itinerary-candidates-sidebar');
        if (candidatesSidebar && draggedItem && draggedDayId) {
            Itinerary.moveItemToCandidate(draggedDayId, draggedItem);
            draggedItem = null;
            draggedDayId = null;
            return;
        }

        // Case 2: 후보 아이템 → Day로 드롭
        const dayCard = e.target.closest('[data-day-id]');
        if (dayCard && draggedCandidateId) {
            const toDayId = dayCard.dataset.dayId;
            Itinerary.addCandidateToDay(draggedCandidateId, null, toDayId);
            draggedCandidateId = null;
            return;
        }

        // Case 3: 일정 아이템 → 다른 Day로 이동 (기존 로직)
        if (!draggedItem || !draggedDayId || !dayCard) return;

        const toDayId = dayCard.dataset.dayId;

        // 드롭 위치 계산
        const overItem = e.target.closest('[data-item-id]');
        let newIndex = 0;

        if (overItem && overItem.dataset.itemId !== draggedItem) {
            const toDay = trip.days.find(d => d.id === toDayId);
            if (toDay) {
                newIndex = toDay.items.findIndex(i => i.id === overItem.dataset.itemId);
                const rect = overItem.getBoundingClientRect();
                if (e.clientY > rect.top + rect.height / 2) {
                    newIndex++;
                }
            }
        } else {
            const toDay = trip.days.find(d => d.id === toDayId);
            if (toDay) {
                newIndex = toDay.items.length;
            }
        }

        Store.moveItineraryItem(trip.id, draggedDayId, toDayId, draggedItem, newIndex);
        Itinerary.render();
        showToast('일정이 이동되었습니다', 'success');
    }

    return {
        showModal,
        closeModal,
        showToast,
        showConfirm,
        escapeHtml,
        formatDate,
        formatDateShort,
        formatCurrency,
        daysUntil,
        timeAgo,
        categoryInfo,
        reservationTypeInfo,
        expenseCategoryInfo,
        getPlaceImage,
        parseGoogleMapsUrl,
        reverseGeocode,
        initDragAndDrop,
        dragState: { get item() { return draggedItem; }, get dayId() { return draggedDayId; }, get candidateId() { return draggedCandidateId; } }
    };
})();
