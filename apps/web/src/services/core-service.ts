import { classes, dashboardData, financeRecords, orders, students, teachers } from "@/src/mocks/core-data";
import type { FinanceSummary } from "@/src/types/domain";
import type {
  ClassQuery,
  FinanceQuery,
  OrderQuery,
  PageResult,
  ServiceResult,
  StudentQuery,
  TeacherQuery,
} from "@/src/types/service";

const NETWORK_LATENCY_MS = 220;

async function withDelay<T>(value: T): Promise<T> {
  await new Promise((resolve) => setTimeout(resolve, NETWORK_LATENCY_MS));
  return value;
}

function paginate<T>(list: T[], page: number, pageSize: number): PageResult<T> {
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  return {
    items: list.slice(start, end),
    page,
    pageSize,
    total: list.length,
  };
}

function containsText(raw: string, keyword?: string): boolean {
  if (!keyword) return true;
  return raw.toLowerCase().includes(keyword.toLowerCase());
}

export async function getDashboard(): Promise<ServiceResult<typeof dashboardData>> {
  return withDelay({ kind: "ok", data: dashboardData });
}

export async function getStudents(query: StudentQuery): Promise<ServiceResult<PageResult<(typeof students)[number]>>> {
  const filtered = students.filter((item) => {
    const keywordPassed = containsText(`${item.name} ${item.phone}`, query.keyword);
    const statusPassed = query.status ? item.status === query.status : true;
    return keywordPassed && statusPassed;
  });
  return withDelay({ kind: "ok", data: paginate(filtered, query.page, query.pageSize) });
}

export async function getTeachers(query: TeacherQuery): Promise<ServiceResult<PageResult<(typeof teachers)[number]>>> {
  const filtered = teachers.filter((item) => {
    const keywordPassed = containsText(`${item.name} ${item.phone} ${item.subject}`, query.keyword);
    const statusPassed = query.status ? item.status === query.status : true;
    return keywordPassed && statusPassed;
  });
  return withDelay({ kind: "ok", data: paginate(filtered, query.page, query.pageSize) });
}

export async function getClasses(query: ClassQuery): Promise<ServiceResult<PageResult<(typeof classes)[number]>>> {
  const filtered = classes.filter((item) => {
    const keywordPassed = containsText(`${item.name} ${item.courseName} ${item.campus}`, query.keyword);
    const statusPassed = query.status ? item.status === query.status : true;
    const teacherPassed = query.teacherName ? item.teacherName.includes(query.teacherName) : true;
    return keywordPassed && statusPassed && teacherPassed;
  });
  return withDelay({ kind: "ok", data: paginate(filtered, query.page, query.pageSize) });
}

export async function getOrders(query: OrderQuery): Promise<ServiceResult<PageResult<(typeof orders)[number]>>> {
  const filtered = orders.filter((item) => {
    const keywordPassed = containsText(`${item.orderNo} ${item.studentName}`, query.keyword);
    const statusPassed = query.status ? item.status === query.status : true;
    const typePassed = query.orderType ? item.orderType === query.orderType : true;
    return keywordPassed && statusPassed && typePassed;
  });
  return withDelay({ kind: "ok", data: paginate(filtered, query.page, query.pageSize) });
}

export async function getFinanceRecords(
  query: FinanceQuery,
): Promise<ServiceResult<{ list: PageResult<(typeof financeRecords)[number]>; summary: FinanceSummary }>> {
  const filtered = financeRecords.filter((item) => {
    const keywordPassed = containsText(`${item.serialNo} ${item.bizType} ${item.operator}`, query.keyword);
    const directionPassed = query.direction ? item.direction === query.direction : true;
    return keywordPassed && directionPassed;
  });
  const totalIncomeYuan = filtered.filter((item) => item.direction === "收入").reduce((sum, item) => sum + item.amountYuan, 0);
  const totalExpenseYuan = filtered.filter((item) => item.direction === "支出").reduce((sum, item) => sum + item.amountYuan, 0);

  return withDelay({
    kind: "ok",
    data: {
      list: paginate(filtered, query.page, query.pageSize),
      summary: {
        totalIncomeYuan,
        totalExpenseYuan,
        netIncomeYuan: totalIncomeYuan - totalExpenseYuan,
      },
    },
  });
}
