import {
  createStudent,
  deleteStudent,
  enrollStudent,
  getCourses,
  getStudentProfile,
  getStudents,
  updateStudent,
} from "@/src/services/core-service";

export const studentGateway = {
  create: createStudent,
  delete: deleteStudent,
  enroll: enrollStudent,
  getCourses,
  getProfile: getStudentProfile,
  list: getStudents,
  update: updateStudent,
};
