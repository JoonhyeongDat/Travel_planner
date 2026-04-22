// 일본 도쿄+알펜루트 5일 여행 데이터 시드
(function seedJapanTrip() {
    // 이미 시드된 경우 중복 방지
    if (localStorage.getItem('japan_trip_seeded')) return;

    const trip = Store.addTrip('도쿄 + 알펜루트 5일', '도쿄, 일본', '2026-05-25', '2026-05-29', 'city');
    const tid = trip.id;

    // 예산 설정
    Store.updateTrip(tid, { totalBudget: 1500000 });

    // 멤버 추가 (기본 '나' 이외 멤버가 있다면 여기서 추가)

    // ===== DAY 1: 도착 & 신주쿠 =====
    const d1 = Store.addDay(tid);
    Store.addItineraryItem(tid, d1.id, { title: '나리타 공항 도착', category: 'transport', startTime: '11:50', endTime: '12:30', address: '나리타 국제공항', notes: 'Suica 카드 구매 & 환전', lat: 35.7647, lng: 140.3864 });
    Store.addItineraryItem(tid, d1.id, { title: '나리타 익스프레스 탑승', category: 'transport', startTime: '13:00', endTime: '14:20', address: '나리타공항 → 신주쿠', notes: '약 80분 소요', cost: 3250 });
    Store.addItineraryItem(tid, d1.id, { title: '호텔 체크인 (신주쿠)', category: 'accommodation', startTime: '14:30', endTime: '15:30', address: '신주쿠, 도쿄', lat: 35.6938, lng: 139.7034 });
    Store.addItineraryItem(tid, d1.id, { title: '신주쿠 가부키초', category: 'place', startTime: '16:00', endTime: '17:00', address: '가부키초, 신주쿠', notes: '고질라 헤드, 번화가 구경', lat: 35.6944, lng: 139.7035 });
    Store.addItineraryItem(tid, d1.id, { title: '도쿄 도청 전망대', category: 'activity', startTime: '17:00', endTime: '18:00', address: '도쿄도청, 니시신주쿠', notes: '무료 야경 (45층)', cost: 0, lat: 35.6896, lng: 139.6917 });
    Store.addItineraryItem(tid, d1.id, { title: '후우운지 (風雲児) 츠케멘', category: 'food', startTime: '18:00', endTime: '19:30', address: '신주쿠구 요요기', notes: '츠케멘 맛집 (줄 대비 17:45 도착 권장)', lat: 35.6846, lng: 139.6977 });
    Store.addItineraryItem(tid, d1.id, { title: '오모이데 요코쵸', category: 'food', startTime: '19:30', endTime: '20:30', address: '니시신주쿠 1초메', notes: '야키토리 + 생맥주', lat: 35.6935, lng: 139.6990 });

    // ===== DAY 2: 시부야·하라주쿠 → 알펜루트 이동 =====
    const d2 = Store.addDay(tid);
    Store.addItineraryItem(tid, d2.id, { title: '1박용 짐 패킹', category: 'activity', startTime: '09:00', endTime: '09:30', notes: '큰 짐 호텔 보관, 1박용 백팩만 챙기기!' });
    Store.addItineraryItem(tid, d2.id, { title: '시부야 스카이 전망대', category: 'activity', startTime: '09:30', endTime: '10:30', address: '시부야 스크램블 스퀘어', notes: '사전 예약 필수', cost: 2000, lat: 35.6580, lng: 139.7022 });
    Store.addItineraryItem(tid, d2.id, { title: '하라주쿠 타케시타도리 + 캣스트리트', category: 'shopping', startTime: '10:30', endTime: '12:00', address: '하라주쿠, 시부야구', notes: '스트릿 패션, 빈티지', lat: 35.6715, lng: 139.7031 });
    Store.addItineraryItem(tid, d2.id, { title: 'AFURI 하라주쿠점 (유자시오라멘)', category: 'food', startTime: '12:00', endTime: '13:00', address: '하라주쿠, 시부야구', notes: '유자시오라멘', lat: 35.6692, lng: 139.7046 });
    Store.addItineraryItem(tid, d2.id, { title: '메이지신궁', category: 'place', startTime: '13:30', endTime: '14:30', address: '메이지신궁, 시부야구', notes: '도심 속 거대 신사', lat: 35.6764, lng: 139.6993 });
    Store.addItineraryItem(tid, d2.id, { title: '오모테산도 쇼핑', category: 'shopping', startTime: '15:00', endTime: '16:00', address: '오모테산도, 미나토구', notes: '편집샵, 명품', lat: 35.6654, lng: 139.7121 });
    Store.addItineraryItem(tid, d2.id, { title: '호텔 짐 픽업', category: 'activity', startTime: '16:00', endTime: '16:30', address: '신주쿠 호텔' });
    Store.addItineraryItem(tid, d2.id, { title: '신주쿠 → 도쿄역', category: 'transport', startTime: '16:30', endTime: '17:15', address: '도쿄역', notes: 'JR', lat: 35.6812, lng: 139.7671 });
    Store.addItineraryItem(tid, d2.id, { title: '호쿠리쿠 신칸센 (도쿄→나가노)', category: 'transport', startTime: '17:30', endTime: '19:40', address: '도쿄역 → 나가노역', cost: 8340, lat: 36.6433, lng: 138.1890 });
    Store.addItineraryItem(tid, d2.id, { title: '나가노역 편의점 저녁', category: 'food', startTime: '19:40', endTime: '20:00', address: '나가노역', lat: 36.6433, lng: 138.1890 });
    Store.addItineraryItem(tid, d2.id, { title: '나가노 → 오마치 이동', category: 'transport', startTime: '20:00', endTime: '21:00', address: '오마치', notes: '버스/택시' });
    Store.addItineraryItem(tid, d2.id, { title: '숙소 체크인 (오마치)', category: 'accommodation', startTime: '21:00', endTime: '21:30', address: '오마치', notes: '료칸 or 비즈니스호텔' });

    // ===== DAY 3: 알펜루트 =====
    const d3 = Store.addDay(tid);
    Store.addItineraryItem(tid, d3.id, { title: '기상 & 조식', category: 'food', startTime: '06:30', endTime: '07:15', address: '오마치 숙소' });
    Store.addItineraryItem(tid, d3.id, { title: '오기자와역 출발', category: 'transport', startTime: '07:30', endTime: '08:00', address: '오기자와역', notes: '일찍 출발!', lat: 36.5639, lng: 137.8617 });
    Store.addItineraryItem(tid, d3.id, { title: '알펜루트 횡단 (오기자와→무로도)', category: 'activity', startTime: '08:00', endTime: '12:00', address: '다테야마 쿠로베 알펜루트', notes: '6가지 교통수단 횡단\n트롤리버스 → 쿠로베 댐 → 유람선 → 로프웨이 → 트롤리버스', cost: 10850, lat: 36.5728, lng: 137.5944 });
    Store.addItineraryItem(tid, d3.id, { title: '무로도 (2,450m) - 유키노오타니', category: 'activity', startTime: '12:00', endTime: '14:00', address: '무로도, 다테야마', notes: '유키노오타니 (20m 눈벽!) + 미쿠리가이케 온천', lat: 36.5728, lng: 137.5944 });
    Store.addItineraryItem(tid, d3.id, { title: '알펜루트 하산 (무로도→다테야마역)', category: 'transport', startTime: '14:00', endTime: '16:30', address: '무로도 → 다테야마역', notes: '고원버스 + 케이블카' });
    Store.addItineraryItem(tid, d3.id, { title: '다테야마역 → 도야마역', category: 'transport', startTime: '16:30', endTime: '17:30', address: '다테야마역 → 도야마역', notes: '지방철도', cost: 1230, lat: 36.6953, lng: 137.2114 });
    Store.addItineraryItem(tid, d3.id, { title: '도야마 스시 (すし玉)', category: 'food', startTime: '17:30', endTime: '18:30', address: '도야마역 주변', notes: '도야마 스시!', lat: 36.6953, lng: 137.2114 });
    Store.addItineraryItem(tid, d3.id, { title: '신칸센 (도야마→도쿄)', category: 'transport', startTime: '19:00', endTime: '21:10', address: '도야마역 → 도쿄역', cost: 12960, lat: 35.6812, lng: 139.7671 });
    Store.addItineraryItem(tid, d3.id, { title: '도쿄 호텔 복귀', category: 'accommodation', startTime: '21:30', endTime: '22:00', address: '신주쿠 호텔', lat: 35.6938, lng: 139.7034 });

    // ===== DAY 4: 아사쿠사·아키하바라·긴자·도쿄타워 =====
    const d4 = Store.addDay(tid);
    Store.addItineraryItem(tid, d4.id, { title: '센소지 (浅草寺)', category: 'place', startTime: '08:30', endTime: '10:00', address: '아사쿠사, 다이토구', notes: '아침 일찍 = 인파 적음', lat: 35.7148, lng: 139.7967 });
    Store.addItineraryItem(tid, d4.id, { title: '아사쿠사 간식거리', category: 'food', startTime: '10:00', endTime: '10:30', address: '나카미세도리, 아사쿠사', notes: '기비단고, 멜론빵, 닌교야키', lat: 35.7118, lng: 139.7960 });
    Store.addItineraryItem(tid, d4.id, { title: '규카츠 모토무라 아키하바라', category: 'food', startTime: '11:30', endTime: '12:15', address: '아키하바라, 치요다구', notes: '규카츠 맛집', lat: 35.6984, lng: 139.7731 });
    Store.addItineraryItem(tid, d4.id, { title: '아키하바라 탐방', category: 'shopping', startTime: '12:15', endTime: '14:00', address: '아키하바라, 치요다구', notes: '요도바시, 세가 아케이드, 피규어', lat: 35.6984, lng: 139.7731 });
    Store.addItineraryItem(tid, d4.id, { title: '츠키지 장외시장', category: 'food', startTime: '14:30', endTime: '15:30', address: '츠키지 장외시장, 추오구', notes: '해산물 간식', lat: 35.6654, lng: 139.7707 });
    Store.addItineraryItem(tid, d4.id, { title: '긴자 쇼핑', category: 'shopping', startTime: '15:30', endTime: '17:00', address: '긴자, 추오구', notes: '유니클로 긴자, 긴자 식스', lat: 35.6717, lng: 139.7649 });
    Store.addItineraryItem(tid, d4.id, { title: '도쿄타워', category: 'activity', startTime: '17:30', endTime: '18:30', address: '도쿄타워, 미나토구', notes: '석양 → 야경', cost: 1200, lat: 35.6586, lng: 139.7454 });
    Store.addItineraryItem(tid, d4.id, { title: '곤파치 (権八) 롯폰기', category: 'food', startTime: '19:00', endTime: '20:30', address: '롯폰기, 미나토구', notes: '킬빌 촬영지 이자카야', lat: 35.6604, lng: 139.7292 });
    Store.addItineraryItem(tid, d4.id, { title: '에비스 요코쵸', category: 'food', startTime: '21:00', endTime: '22:30', address: '에비스, 시부야구', notes: '현지인 분위기 2차', lat: 35.6467, lng: 139.7103 });

    // ===== DAY 5: 쇼핑 마무리 & 출국 =====
    const d5 = Store.addDay(tid);
    Store.addItineraryItem(tid, d5.id, { title: '기상 + 짐 패킹', category: 'activity', startTime: '06:00', endTime: '06:30' });
    Store.addItineraryItem(tid, d5.id, { title: '체크아웃', category: 'accommodation', startTime: '06:30', endTime: '06:45', address: '신주쿠 호텔' });
    Store.addItineraryItem(tid, d5.id, { title: '편의점 아침', category: 'food', startTime: '06:45', endTime: '07:00', notes: '오니기리 + 커피' });
    Store.addItineraryItem(tid, d5.id, { title: '나리타 익스프레스 (신주쿠→나리타)', category: 'transport', startTime: '07:00', endTime: '08:20', address: '신주쿠 → 나리타공항', cost: 3250, lat: 35.7647, lng: 140.3864 });
    Store.addItineraryItem(tid, d5.id, { title: '체크인 + 수하물 위탁', category: 'activity', startTime: '08:30', endTime: '09:30', address: '나리타 공항' });
    Store.addItineraryItem(tid, d5.id, { title: '면세점 쇼핑', category: 'shopping', startTime: '09:30', endTime: '11:00', address: '나리타 공항 면세구역' });
    Store.addItineraryItem(tid, d5.id, { title: '✈️ 출발', category: 'transport', startTime: '11:40', endTime: '14:00', address: '나리타 공항', notes: '출국!' });

    // ===== 예약 정보 =====
    Store.addReservation(tid, { type: 'flight', name: '인천 → 나리타 (도착편)', date: '2026-05-25', time: '11:50', status: 'confirmed', location: '나리타 공항', notes: '항공편' });
    Store.addReservation(tid, { type: 'flight', name: '나리타 → 인천 (출국편)', date: '2026-05-29', time: '11:40', status: 'confirmed', location: '나리타 공항', notes: '항공편' });
    Store.addReservation(tid, { type: 'train', name: '나리타 익스프레스 (왕복)', cost: 6500, date: '2026-05-25', status: 'confirmed', notes: '편도 ¥3,250 × 2' });
    Store.addReservation(tid, { type: 'train', name: '호쿠리쿠 신칸센 (도쿄→나가노)', cost: 8340, date: '2026-05-26', time: '17:30', status: 'pending', notes: 'JR 와이드패스 고려' });
    Store.addReservation(tid, { type: 'ticket', name: '알펜루트 편도 통과권', cost: 10850, date: '2026-05-27', status: 'pending', notes: '오기자와 → 다테야마 방향' });
    Store.addReservation(tid, { type: 'train', name: '신칸센 (도야마→도쿄)', cost: 12960, date: '2026-05-27', time: '19:00', status: 'pending', notes: 'JR 와이드패스 고려' });
    Store.addReservation(tid, { type: 'hotel', name: '신주쿠 호텔 (4박)', date: '2026-05-25', endDate: '2026-05-29', status: 'pending', location: '신주쿠', notes: 'DAY1,2(짐보관),4,5 숙박' });
    Store.addReservation(tid, { type: 'hotel', name: '오마치/알펜루트 숙소 (1박)', date: '2026-05-26', endDate: '2026-05-27', status: 'pending', location: '오마치', notes: '료칸 or 비즈니스호텔', cost: 10000 });
    Store.addReservation(tid, { type: 'ticket', name: '시부야 스카이 전망대', cost: 2000, date: '2026-05-26', time: '09:30', status: 'pending', notes: '사전 예약 필수' });
    Store.addReservation(tid, { type: 'ticket', name: '도쿄타워 입장권', cost: 1200, date: '2026-05-28', time: '17:30', status: 'pending' });

    // ===== 체크리스트 =====
    const c1 = Store.addChecklistCategory(tid, '여권/서류', '📄');
    Store.addChecklistItem(tid, c1.id, '여권 (유효기간 6개월 이상)');
    Store.addChecklistItem(tid, c1.id, '항공권 e-티켓');
    Store.addChecklistItem(tid, c1.id, '호텔 예약 확인서');
    Store.addChecklistItem(tid, c1.id, '해외여행자보험');
    Store.addChecklistItem(tid, c1.id, 'Visit Japan Web 등록');

    const c2 = Store.addChecklistCategory(tid, '교통', '🚃');
    Store.addChecklistItem(tid, c2.id, 'Suica 카드 (공항에서 구매)');
    Store.addChecklistItem(tid, c2.id, 'JR 와이드패스 검토');
    Store.addChecklistItem(tid, c2.id, '나리타 익스프레스 예약');
    Store.addChecklistItem(tid, c2.id, '알펜루트 티켓 구매');
    Store.addChecklistItem(tid, c2.id, '시부야 스카이 사전 예약');

    const c3 = Store.addChecklistCategory(tid, '짐 싸기', '🧳');
    Store.addChecklistItem(tid, c3.id, '캐리어');
    Store.addChecklistItem(tid, c3.id, '1박용 백팩 (알펜루트)');
    Store.addChecklistItem(tid, c3.id, '방한복 (알펜루트 2,450m 추위)');
    Store.addChecklistItem(tid, c3.id, '선글라스 (눈벽 반사)');
    Store.addChecklistItem(tid, c3.id, '충전기 & 보조배터리');
    Store.addChecklistItem(tid, c3.id, '여행용 어댑터 (일본 110V)');
    Store.addChecklistItem(tid, c3.id, '우산/우비');
    Store.addChecklistItem(tid, c3.id, '세면도구');

    const c4 = Store.addChecklistCategory(tid, '금융', '💰');
    Store.addChecklistItem(tid, c4.id, '엔화 환전');
    Store.addChecklistItem(tid, c4.id, '해외 결제 카드 준비');
    Store.addChecklistItem(tid, c4.id, '트래블 체크카드 충전');

    // 시드 완료 표시
    localStorage.setItem('japan_trip_seeded', 'true');
    console.log('✅ 일본 여행 데이터 시드 완료!');
})();
