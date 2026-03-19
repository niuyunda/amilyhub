# API Catalog Master (Source SaaS)

> Status: Phase-1 initial capture complete (menu-level page scan).

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

## Raw Artifact
- `docs/api-catalog/raw/2026-03-20-initial-page-scan.json`

## Next-pass TODO (required to reach "no omission")
1. For each page, trigger **search/filter/pagination** and capture additional APIs.
2. Trigger **create/edit/delete/import/export** actions (if available) to capture mutation endpoints.
3. Capture request method + request/response schema samples.
4. Build deduplicated endpoint table with fields:
   - service prefix, path, method, auth mode, key params, pagination mode, business owner module.
