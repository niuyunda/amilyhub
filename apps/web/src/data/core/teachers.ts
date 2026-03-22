import {
  createTeacher,
  getTeachers,
  updateTeacher,
  updateTeacherStatus,
} from "@/src/services/core-service";

export const teacherGateway = {
  create: createTeacher,
  list: getTeachers,
  update: updateTeacher,
  updateStatus: updateTeacherStatus,
};
