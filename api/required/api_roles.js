//Created by   :- Manglesh Patel
//Created Date :- 01-04-2021
//Description  :- api list with access roles
var api_list = {
  ////////// super admin api start //////////
  'getEmployeeList':['superadmin'],
  'getEmployeeDetailsById':['superadmin','employee'],
  'addUpdateEmployeeDetails':['superadmin'],
  'endEmployeeSession':['superadmin'],
  'approveLeaveApplication':['superadmin'],
  'getEmployeesDailyWorksheetData':['superadmin','employee'],
  'getAllEmployeeReportCard':['superadmin'],
  'getWorkingMonthsList':['superadmin','employee'],
  'uploadZipDocument':['superadmin'],
  'addUpdateBusinessHolidays':['superadmin'],
  'deleteBusinessHolidays':['superadmin'],
  'getBusinessHolidayList':['superadmin','employee'],
  ////////// super admin api end //////////
  'addUpdateDailyWorkData':['employee'],
  'addUpdateLeaveApplication':['employee'],
  'getEmployeesDailyWorkById':['employee'],
  'addUpdateDailyWorkData':['employee'],
  'getEmployeesDailyWorkByDate':['employee'],
};

module.exports = api_list;
