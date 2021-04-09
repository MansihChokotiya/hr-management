//Created By:- EP-Manglesh
//Description:- Employee login and all other stuffs related to employee
//Created Date:- 01/04/2021
const async = require('async');
const env = require('../env');
const connection = env.dbconnection;
const transporter = env.transporter;
const mkdirp = require('mkdirp');
const CRUD = require('mysql-crud');
const underscore = require('underscore');
const extend = require('xtend');
const bcrypt = require('bcrypt');
const common_functions = require('../functions');
const saltRounds = 10;
const employeeService = {
    //@Manglesh
    getEmployeeDetailsByEmail : function(email_address,callback){
      let query1 = "SELECT `userid`, `name`, `mobile`, `email`, `salary`, `leave_credit`, `start_date`, `end_date`, `increament_date`, `document`, `modified_on`, `created_on` FROM `employee` WHERE email = ?";
      connection.query(query1,[email_address],function(error,result){
        if(error){
          console.log("Error#001 in 'employeeService.js'",error,query1);
          callback(error,{status:false,message:"Error in getting data!!",data:[],http_code:400});
        }else{
          if(result && result.length>0){
            callback(null,{status:true,message:"Employee found successfully!!",data:result,http_code:200});
          }else {
            callback(null,{status:false,message:"Employee does not exist in system!!",data:[],http_code:400});
          }
        }
      });
    },
    //@Manglesh
    loginEmployee : function(body,callback){
      employeeService.getEmployeeDetailsByEmail(body.username,function(error,result_data){
        if(error){
          console.log("Error#001 in 'employeeService.js'",error);
          callback(error,{status:false,message:"Error in getting data!!",data:false,http_code:400});
        }else{
          var result=result_data.data;
          if(result.length > 0){
            // check if employee session is end
            if(result[0].end_date && result[0].end_date <= (+new Date())){
              callback(null,{status:false,message:"Employee session is ended!!",data:false,http_code:400});
            }else {
              let profile = result[0];
              let bcrypt_password = profile.bcrypt_password;
              delete profile.bcrypt_password; // removing bcrypt_password from profile to prevent from sending to client;
              bcrypt.compare(body.password, bcrypt_password,function(err,matched) {
                if(matched){
                  //password matched let the user access system.
                  var resdata = {};
                  var userprofile = [profile];
                  var token = common_functions.genToken(userprofile);
                  resdata.token = token;
                  resdata.record = userprofile;
                  userprofile[0].user_type = 'employee';
                  callback(null,{status:true,message:"Employee logged-in successfully!!",data:resdata,http_code:200});
                  //insert into logged_in_user table
                  var query = "insert into logged_in_users (userid,user_type,email_address,token) values "
                  query += "(" + userprofile[0].userid + ",'employee','" + val[0].email + "','" + token + "')";
                  connection.query(query, function(error, result) {
                    if (error) {
                      console.log("Error:#S002 in 'employeeService.js'",error,query);
                    }
                  });
                }else{
                  callback(null,{status:false,message:"Password does not match!!",data:false,http_code:400});
                }
              });
            }
          }else{
            callback(null,{status:false,message:"Username does not exists!!",data:false,http_code:400});
          }
        }
      });
    },

    addUpdateDailyWorkData : function(body,callback){
      let date = body.date, userid = body.userid, work_data = body.work_data;
      let row_ids = underscore.unique(underscore.pluck(work_data,'row_id'));
      let filteredIds = row_ids.filter(function(d){
        if(d){
          return d;
        }
      });
      // check and get existing data from employee_worksheet
      employeeService.getWorksheetDataByRowIds(filteredIds,userid,function(error,resposne){
        if(error){
          console.log("Error#004 in 'employeeService.js'",error);
          callback(error,{status:false,message:"#004:Error in saving data!!",data:false,http_code:400});
        }else {
          let existingIds = underscore.unique(underscore.pluck(resposne.data,'row_id'));
          async.eachOfSeries(work_data,function(row,index,cb){
            let insertQuery = "";
            if(row.row_id){
              if(existingIds.indexOf(row.row_id) > -1){
                // remove those row ids which are already existings, then we will delete left ids from existingIds array
                existingIds.splice(existingIds.indexOf(row.row_id), 1);
              }
              // row_id exist then update the row
              insertQuery = "UPDATE `employee_worksheet` SET `module`="+connection.escape(row.module)+",`description`="+connection.escape(row.description)+",`date`="+date+",`start_time`="+connection.escape(row.start_time)+",`end_time`="+connection.escape(row.end_time)+",`modified_on`= "+env.timestamp()+" WHERE row_id = "+row.row_id+" and userid = "+userid+" ";
            }else {
              // insert data for new row
              insertQuery = "INSERT INTO `employee_worksheet`(`userid`, `module`, `description`, `date`, `start_time`, `end_time`, `created_on`, `modified_on`) ";
              insertQuery += " VALUES ("+userid+","+connection.escape(row.module)+","+connection.escape(row.description)+","+date+","+connection.escape(row.start_time)+","+connection.escape(row.end_time)+","+env.timestamp()+","+env.timestamp()+")";
            }
            connection.query(insertQuery,function(error,result){
              if(error){
                console.log("Error#001 in 'employeeService.js'",error,insertQuery);
                return cb(error);
              }else{
                cb();
              }
            });
          },function(error){
            if(error){
              console.log("Error#001 in 'employeeService.js'",error);
              callback(error,{status:false,message:"#001:Error in saving data!!",data:false,http_code:400});
            }else{
              if(existingIds && existingIds.length > 0){
                // delete row ids which are not existing any more
                let deleteQuery = "DELETE FROM `employee_worksheet` WHERE `row_id` IN ("+existingIds+") AND `userid`="+userid;
                connection.query(deleteQuery,function(error,result){
                  if(error){
                    console.log("Error#005 in 'employeeService.js'",error,deleteQuery);
                    callback(error,{status:false,message:"#005:Error in saving data!!",data:false,http_code:400});
                  }else{
                    callback(null,{status:true,message:"Work data saved successfully!!",data:{},http_code:200});
                  }
                });
              }else {
                callback(null,{status:true,message:"Work data saved successfully!!",data:{},http_code:200});
              }
            }
          });
        }
      });
    },

    getWorksheetDataByRowIds : function(rowIds,userid,callback){
      if(rowIds && rowIds.length){
        let query = "select * from employee_worksheet where row_id IN ("+rowIds+") and userid = "+userid;
        connection.query(query,function(error,result){
          if(error){
            console.log("Error#003 in 'employeeService.js'",error,query);
            callback(error,{status:false,message:"Error in getting data!!",data:[],http_code:400});
          }else{
            callback(null,{status:true,message:"Work data fetched successfully!!",data:result,http_code:200});
          }
        });
      }else {
        callback(null,{status:true,message:"Work data fetched successfully!!",data:[],http_code:200});
      }
    },

    getEmployeesDailyWorkByDate : function(body,callback){
      let date = body.date;
      let start = new Date(date);
      start.setHours(0,0,0,0);
      var sdate = +new Date(start);
      // end date
      let end = new Date(date);
      end.setHours(23,59,59,999);
      var edate = +new Date(end);
      let query = "select * from employee_worksheet where `date` >= "+sdate+" AND `date` <= "+edate+" and userid = "+userid;
      connection.query(query,function(error,result){
        if(error){
          console.log("Error#003 in 'employeeService.js'",error,query);
          callback(error,{status:false,message:"Error in getting data!!",data:[],http_code:400});
        }else{
          callback(null,{status:true,message:"Work data fetched successfully!!",data:result,http_code:200});
        }
      });
    },

    addUpdateLeaveApplication : function(body,callback){
      let userid = body.userid;
      let date_from = +body.date_from;
      let date_to = +body.date_to;
      let start_date = new Date(date_from);
      let end_date = new Date(date_to);
      let datesArray = getDates(start_date, end_date);
      // if datesArray is empty then start date and end dates are same then push start date in array.
      if(datesArray.length==0){
        datesArray.push(start_date);
      }else {
        let last_date = datesArray[datesArray.length - 1];
        if(last_date.getDate() == last_date.getDate() && last_date.getMonth() == last_date.getMonth() && last_date.getFullYear() == last_date.getFullYear()){
          // nothing to do
        }else {
          // if last item of array is not same as end date then push end date
          datesArray.push(end_date);
        }
      }
      let inserted = false;
      async.eachOfSeries(datesArray,function(single_date,index,cb){
        employeeService.getHolidayByGivenDate(single_date,function(error,response){
          if(error){
            return cb(error);
          }else {
            let holiday = response.data && response.data.length > 0 ? true : false;
            if(holiday){
              // if holiday then do not add row
              cb();
            }else {
              // insertQuery = "UPDATE `leave_application` SET `description`="+connection.escape(body.description)+",`date_from`="+body.date_from+",`date_to`="+body.date_from+",`total_days`=1,`modified_on`="+env.timestamp()+" WHERE row_id = "+body.row_id+" and userid = "+userid+" ";
              let insertQuery = "INSERT INTO `leave_application`(`userid`, `description`, `date_from`, `date_to`, `total_days`, `approve_status`, `created_on`, `modified_on`) ";
              insertQuery += " VALUES ("+userid+","+connection.escape(body.description)+","+body.date_from+","+body.date_from+",1,0,"+env.timestamp()+","+env.timestamp()+")";
              connection.query(insertQuery,function(error,result){
                if(error){
                  console.log("Error#002 in 'employeeService.js'",error,insertQuery);
                  return cb(error);
                }else{
                  inserted = true;
                  cb();
                }
              });
            }
          }
        });
      },function(error){
        if(error){
          console.log("Error#0021 in 'employeeService.js'",error,insertQuery);
          callback(error,{status:false,message:"Error in saving data!!",data:false,http_code:400});
        }else{
          callback(null,{status:true,message:"Leave application saved successfully!!",data:result.insertId,http_code:200});
        }
      });
    },

    getHolidayByGivenDate : function(date,callback){
      let start = date;
      start.setHours(0,0,0,0);
      var sdate = +new Date(start);
      // end date
      let end = date;
      end.setHours(23,59,59,999);
      var edate = +new Date(end);

      let query = "SELECT * FROM `holidays` WHERE `date` >= "+sdate+" AND `date` <= "+edate;
      connection.query(query, function (error, result) {
        if (error) {
          console.log("Error#0061 in 'employeeService.js'", error, query);
          callback(error, {status: false, message: "Error in getting data!!", data: [], http_code: 400});
        } else {
          callback(null, {status: true,message: "Holiday found successfully!!",data: result,http_code: 200});
        }
      });
    },

    getLeaveApplicationById : function(body,callback){
      let query = "SELECT * FROM `leave_application` WHERE `row_id`="+body.row_id+" AND `userid` = "+body.userid;
      connection.query(query, function (error, result) {
        if (error) {
          console.log("Error#006 in 'employeeService.js'", error, query);
          callback(error, {status: false, message: "Error in getting data!!", data: [], http_code: 400});
        } else {
          callback(null, {status: true,message: "Leave application found successfully!!",data: result,http_code: 200});
        }
      });
    },

    deleteLeaveApplication : function(body,callback){
      let userid = body.userid, row_id = body.row_id;
      employeeService.getLeaveApplicationById(body,function(error,response){
        if(error){
          callback(error, {status: false, message: "Error in deleting data!!", data: {}, http_code: 400});
        }else {
          let leaveData = response.data;
          let date_from = leaveData && leaveData.length > 0 ? leaveData[0].date_from : 0;
          let today_date = +new Date();
          if(date_from <= today_date){
            callback(error, {status: false, message: "Leave date is expired!!", data: {}, http_code: 400});
          }else {
            let deleteQuery = "DELETE FROM `leave_application` WHERE `row_id`="+body.row_id+" AND `userid` = "+body.userid;
            connection.query(deleteQuery, function (error, result) {
              if (error) {
                console.log("Error#006 in 'employeeService.js'", error, deleteQuery);
                callback(error, {status: false, message: "Error in deleting data!!", data: [], http_code: 400});
              } else {
                callback(null, {status: true,message: "Leave application deleted successfully!!",data: [],http_code: 200});
              }
            });
          }
        }
      });
    }
};
module.exports = employeeService;

function getDates(startDate, stopDate) {
  var dateArray = new Array();
  var currentDate = startDate;
  while (currentDate < stopDate) {
    dateArray.push(new Date (currentDate));
    currentDate = addDays(currentDate,1);
  }
  return dateArray;
}

function addDays(date,days) {
  date.setDate(date.getDate() + days);
  return date;
}
