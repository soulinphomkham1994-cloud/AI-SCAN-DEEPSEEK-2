// Google Apps Script - ວາງໂຄ້ດນີ້ໃນ Google Apps Script Editor
const SPREADSHEET_ID = '1D6R0ZDiyXJJm02LnzG-QKJWAWSM-LO29axqQOZs8Ua4'; // ໃສ່ Spreadsheet ID ຂອງທ່ານ
const ADMIN_PASSWORD = 'admin123'; // ຄືກັບໃນ config.js

function doGet(e) {
  const action = e.parameter.action;
  const password = e.parameter.password;
  
  if (password !== ADMIN_PASSWORD) {
    return ContentService.createTextOutput(JSON.stringify({ error: 'Unauthorized' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  if (action === 'getEmployees') {
    return getEmployees();
  } else if (action === 'getAttendance') {
    const date = e.parameter.date;
    return getAttendance(date);
  }
  
  return ContentService.createTextOutput(JSON.stringify({ error: 'Invalid action' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const action = data.action;
  
  if (action === 'register') {
    if (data.password !== ADMIN_PASSWORD) {
      return ContentService.createTextOutput(JSON.stringify({ error: 'Unauthorized' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    return registerEmployee(data.employee);
  } else if (action === 'checkin' || action === 'checkout') {
    return recordAttendance(data);
  }
  
  return ContentService.createTextOutput(JSON.stringify({ error: 'Invalid action' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function getEmployees() {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Employees');
    if (!sheet) {
      // Create sheet if not exists
      const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
      ss.insertSheet('Employees');
      sheet = ss.getSheetByName('Employees');
      sheet.appendRow(['ID', 'Name', 'Position', 'Descriptor', 'RegisteredAt']);
    }
    
    const data = sheet.getDataRange().getValues();
    const employees = [];
    
    for (let i = 1; i < data.length; i++) {
      employees.push({
        id: data[i][0],
        name: data[i][1],
        position: data[i][2],
        descriptor: JSON.parse(data[i][3]),
        registeredAt: data[i][4]
      });
    }
    
    return ContentService.createTextOutput(JSON.stringify(employees))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function registerEmployee(employee) {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Employees');
    sheet.appendRow([
      employee.id,
      employee.name,
      employee.position,
      JSON.stringify(employee.descriptor),
      employee.registeredAt
    ]);
    
    return ContentService.createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function recordAttendance(data) {
  try {
    let sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Attendance');
    if (!sheet) {
      const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
      sheet = ss.insertSheet('Attendance');
      sheet.appendRow(['Date', 'Employee ID', 'Employee Name', 'Check In', 'Check Out', 'Location']);
    }
    
    const date = data.timestamp.split('T')[0];
    const time = data.timestamp.split('T')[1].split('.')[0];
    const locationStr = `${data.location.lat},${data.location.lng}`;
    
    // Check if record exists for today
    const existingData = sheet.getDataRange().getValues();
    let rowIndex = -1;
    
    for (let i = 1; i < existingData.length; i++) {
      if (existingData[i][0] === date && existingData[i][1] === data.employeeId) {
        rowIndex = i + 1;
        break;
      }
    }
    
    if (rowIndex === -1) {
      // New record
      if (data.action === 'checkin') {
        sheet.appendRow([date, data.employeeId, data.employeeName, time, '', locationStr]);
      } else {
        sheet.appendRow([date, data.employeeId, data.employeeName, '', time, locationStr]);
      }
    } else {
      // Update existing record
      const row = sheet.getRange(rowIndex, 1, 1, 6);
      const rowData = row.getValues()[0];
      
      if (data.action === 'checkin' && !rowData[3]) {
        rowData[3] = time;
      } else if (data.action === 'checkout' && !rowData[4]) {
        rowData[4] = time;
      }
      
      row.setValues([rowData]);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function getAttendance(date) {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Attendance');
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify([]))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    const data = sheet.getDataRange().getValues();
    const records = [];
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === date) {
        records.push({
          id: data[i][1],
          name: data[i][2],
          checkin: data[i][3],
          checkout: data[i][4],
          location: data[i][5]
        });
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify(records))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
    }
}