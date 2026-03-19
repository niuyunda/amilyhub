# API Catalog Master (Source SaaS)

> Status: Phase-1 second-pass deep scan in progress (key modules validated with method + body keys).

## Collection Method
- Google Chrome (user profile, logged-in SaaS account)
- Navigated each target business page via top menu
- For each page: clear performance resource buffer -> open page -> wait for load -> extract XHR/fetch request paths
- Sanitization: only stored URL paths (no token/query secrets)

## Captured Routes and Endpoints

### 教务中心 / 学员管理 (`#/student/active_student_list`)
- `/business/public/student/getLearningStudentPageCheckPermission`
- `/business/public/student/getStuWeChatBindNum`
- `/business/public/admin/getAccountList`
- `/business/public/attr/getInstAttrList`
- `/business/public/inst/getConfigAttrs`
- `/business/public/sms/getInstSmsWarningInfo`
- `/business/public/student/getBirthDayStudentList`
- `/business/public/stuHead/getAdminHeadList`

### 教务中心 / 班级管理 (`#/class_manager/one_to_many_class`)
- `/business/public/class/list`
- `/business/public/classTag/getClassTagByPage`
- `/business/public/config/getCampusConfigAndHornBizType`
- `/business/public/course/digestList`
- `/business/public/course/getCoursePage`
- `/business/public/teacher/getTeachersForQueryClass`

### 教务中心 / 课表管理 (`#/plan/time_schedule`)
- `/business/public/class/digestList`
- `/business/public/classroom/getClassRoomDigestPage`
- `/business/public/config/getTimeTableRange`
- `/business/public/course/digestList`
- `/business/public/holiday/getInstList`
- `/business/public/reserve/existScheduleReserve`
- `/business/public/teacher/getTeacherDigestPage`
- `/business/public/timetable/inst/card`

### 教务中心 / 上课记录 (`#/class_record/take_name_record`)
- `/business/public/class/digestList`
- `/business/public/course/digestList`
- `/business/public/leave/unDealNum`
- `/business/public/rollCall/queryInstRollCalls`
- `/business/public/teacher/getTeacherDigestPage`

### 教务中心 / 课程管理 (`#/course_fees_manage/course_manage`)
- `/business/public/config/getCampusConfigAndHornBizType`
- `/business/public/course/getCoursePage`
- `/business/public/guide/isAlert`

### 教务中心 / 物品/费用 (`#/course_fees/goods_manager`)
- `/business/public/config/getCampusConfigAndHornBizType`
- `/business/public/goods/countLackStockGoodsNum`
- `/business/public/goods/queryGoodsPage`

### 财务中心 / 订单管理 (`#/order_manage/order_list`)
- `/business/public/admin/queryDigestPageByName`
- `/business/public/axf/getMerchant`
- `/business/public/eleContract/getNormalTemplateList`
- `/business/public/order/searchPage`
- `/business/public/order/sumVouchersFee`
- `/business/public/stuHead/getAdminHeadList`
- `/datacenter/public/admin/checkBindStatus`
- `/finance/public/xmpay/getInstChannelStatus`

### 财务中心 / 收支明细 (`#/income_expanse_manage/income_expanse_list`)
- `/business/public/admin/queryDigestPageByName`
- `/business/public/carousel/getEnableCarousel`
- `/business/public/instIncomeExpense/amountSum`
- `/business/public/instIncomeExpense/queryAccount`
- `/business/public/instIncomeExpense/queryItem`
- `/business/public/instIncomeExpense/queryOnePage`
- `/business/public/paymentWay/queryListFixed`
- `/finance/public/cashier/getConfig`
- `/finance/public/cashierWallet/checkProtocol`
- `/finance/public/cashierWallet/checkProtocolWhiteList`
- `/finance/public/xmpay/getInstChannelStatus`

### 财务中心 / 课消记录 (`#/course_consumption_record`)
- `/business/public/carousel/getEnableCarousel`
- `/business/public/class/digestList`
- `/business/public/course/digestList`
- `/business/public/studentHourCostFlow/queryPage`
- `/business/public/studentHourCostFlow/sum`
- `/business/public/teacher/getTeachersForQueryClass`
- `/finance/public/cashier/getConfig`
- `/finance/public/cashierWallet/checkProtocol`
- `/finance/public/cashierWallet/checkProtocolWhiteList`
- `/finance/public/xmpay/getInstChannelStatus`

## Deep Scan - Key Business Data Endpoints (Round 2)

### 订单（高优先）
- `POST /business/public/order/searchPage`
  - keys: `bizAccountId,size,current,businessStates,businessTypes,businessOwnerIds,sortType,createdStart,createdEnd,businessNo,isStudentEntrance`
- `POST /business/public/order/sumVouchersFee`
  - keys: same as searchPage
- `POST /business/public/order/getVoucherDetailCheckPermission`
  - keys: `voucherId`
- `POST /business/public/order/checkBusinessVoucherHasEleContract`
  - keys: `instId,voucherId`
- `POST /business/public/voucherApproval/getDetailBySubjectId`
  - keys: `id`
- `POST /business/public/voucherApproval/getApprovalChainNodes`
  - keys: `id`

### 学生（高优先）
- `POST /business/public/student/getLearningStudentPage`
  - keys: `current,size,status,basicRequest,expandRequest,timeRangeRequest,filterRequest,tagAndAttrRequest`
- `POST /business/public/student/getStuByNamePhoneCheckPermission`
  - keys: `statusList,nameLike,phoneLike,studentId,current,size,instId`
- supporting lookups:
  - `POST /business/public/studentTag/getTagList`
  - `POST /business/public/attr/getInstAttrList`
  - `POST /business/public/admin/getAccountList`
  - `POST /business/public/sms/getInstSmsWarningInfo`

### 老师（高优先）
- `POST /business/public/teacher/getTeacherBuffPage`
  - keys (list): `current,size`
  - keys (search): `current,size,nameOrPhone`

### 上课记录（高优先）
- `POST /business/public/rollCall/queryInstRollCalls`
  - keys: `current,size,stateFilter,rollCallDateStart,rollCallDateEnd,stateList`

### 财务收支（高优先）
- `POST /business/public/instIncomeExpense/queryOnePage`
  - keys: `current,size,discardFlag,operationDateStart,operationDateEnd`
- `POST /business/public/instIncomeExpense/amountSum`
  - keys: same as queryOnePage

### 课消记录（高优先）
- `POST /business/public/studentHourCostFlow/queryPage`
  - keys: `checkedDateStart,checkedDateEnd,current,size,justValid,createdEnd`
- `POST /business/public/studentHourCostFlow/sum`
  - keys: same as queryPage

## Raw Artifacts
- `docs/api-catalog/raw/2026-03-20-initial-page-scan.json`
- `docs/api-catalog/raw/2026-03-20-deep-scan-key-modules.json`

## Remaining Risk / TODO (to reach no-omission)
1. Trigger create/edit dialogs for students, classes, courses, teachers, orders and capture mutation APIs.
2. Trigger export/import buttons per module and capture async task/download endpoints.
3. Open row-level “详情/编辑/操作日志/课后点评”等 action links and record extra detail APIs.
4. Build a normalized table (`method + path`) with request sample and response top-level schema.
5. Add data-domain mapping to ensure no core entity遗漏: student, teacher, class, course, order, payment, rollcall, hour-cost-flow, income-expense.
