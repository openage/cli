export default [{
    code: 'ENV_INIT_RESOURCE_NOT_FOUND',
    name: 'Initializing environment',
    level: 'fatal',
    message: 'Cannot initialize the environment.',
    actions: [{
        'type': 'message',
        'config': {
            message: 'Check logs'
        }
    }]
},
{
    code: 'CMD_RUN_UNKNOWN_ERROR',
    name: 'Unknown Error',
    level: 'fatal',
    message: 'An unexpected error occurred. Please check the log file for details:'
},
{
    code: 'CMD_RUN_RESOURCE_NOT_FOUND',
    name: 'Endpoint Error',
    level: 'fatal',
    message: 'data does not exist'
},
{
    code: 'HANDLER_NF',
    name: 'invalid input',
    level: 'error',
    message: "Handeler for '{{data}}' not found"
},
{
    code: 'ACTION_NF',
    name: 'invalid input',
    level: 'error',
    message: "Action '{{data}}' not found"
},
{
    code: 'missing-values',
    name: 'invalid input',
    level: 'error',
    message: 'Missing required fields'
},
{
    code: 'NAME_DMC',
    name: 'invalid input',
    level: 'warn',
    message: 'Must have only Alphabets',
    actions: []
},
{
    code: 'LOGIN_EMAIL_DNE',
    name: 'unregistered email',
    level: 'warn',
    message: 'You need to signup first',
    actions: []
},
{
    code: 'DI_ULO_INV',
    name: 'invalid credentials',
    level: 'warn',
    message: 'Please check you input',
    actions: []
},
{
    code: 'DI_ULO_UDNE',
    name: 'invalid credentials',
    level: 'warn',
    message: 'This user is not registered',
    actions: []
},
{
    code: 'DI_USI_IREQ',
    name: 'unknown error',
    level: 'warn',
    message: 'Fix Me: Add error',
    actions: []
},
{
    code: 'LOGIN_MOBILE_DNE',
    name: 'unregistered mobile',
    level: 'warn',
    message: 'You need to signup first',
    actions: []
},
{
    code: 'LOGIN_EMPLOYEE_DNE',
    name: 'unregistered employee no',
    level: 'warn',
    message: 'Are you sure this employment code is registered',
    actions: []
},
{
    code: 'CODE_DNE',
    name: 'code does not exist',
    level: 'warn',
    message: 'You need to signup first',
    actions: []
},
{
    code: 'LOGIN_PASSWORD_NOT_SET',
    name: 'reset password',
    level: 'warn',
    message: 'You need to set/reset your password',
    actions: []
},
{
    code: 'PASSWORD_DMC',
    name: 'password does not meet criteria',
    level: 'warn',
    message: 'Minimum of 8 and maximum of 16 characters, at least one uppercase letter, one lowercase letter, one number and one special character',
    actions: []
},
{
    code: 'PASSWORD_INVALID',
    name: 'wrong password',
    level: 'warn',
    message: 'Do you want to reset your password',
    actions: []
},
{
    code: 'PASSWORD_DNM',
    name: 'password does not match',
    level: 'warn',
    message: 'Confirm password should be same as New Password',
    actions: []
},
{
    code: 'CUSTOMER_NAME_REQUIRED',
    name: 'customer name missing',
    level: 'warn',
    message: 'Customer name is required',
    actions: []
},
{
    code: 'CUSTOMER_EMAIL_REQUIRED',
    name: 'customer email missing',
    level: 'warn',
    message: 'Customer email is required',
    actions: []
},
{
    code: 'CUSTOMER_PHONE_REQUIRED',
    name: 'customer phone missing',
    level: 'warn',
    message: 'Customer phone is required',
    actions: []
},
{
    code: 'ORGANIZATION_NAME_EXISTS',
    name: 'Name is already in use',
    level: 'warn',
    message: 'Organization name is required',
    actions: []
},
{
    code: 'GST_EXISTS',
    name: 'GST is already in use',
    level: 'warn',
    message: 'GST needs to be unique',
    actions: []
},
{
    code: 'PHONE_EXISTS',
    name: 'Phone is already in use',
    level: 'warn',
    message: 'Phone needs to be unique',
    actions: []
},
{
    code: 'EMAIL_EXISTS',
    name: 'Email is already in use',
    level: 'warn',
    message: 'Email needs to be unique',
    actions: []
},
{
    code: 'CODE_DMC',
    name: 'code is too short',
    level: 'warn',
    message: 'Code needs to be more than 3 characters',
    actions: []
},
{
    code: 'ACCOUNT_CODE_DMC',
    name: 'account number is invalid',
    level: 'warn',
    message: 'Code needs to be between than 6 to 18 characters',
    actions: []
},
{
    code: 'TENANT_CODE_DMC',
    name: 'code is too short',
    level: 'warn',
    message: 'Code needs to be more than 3 characters',
    actions: []
},
{
    code: 'ORGANIZATION_CODE_DMC',
    name: 'code is too short',
    level: 'warn',
    message: 'Code needs to be more than 3 characters',
    actions: []
},
{
    code: 'USER_CODE_DMC',
    name: 'code is too short',
    level: 'warn',
    message: 'Code needs to be more than 5 characters',
    actions: []
},
{
    code: 'IPA_DMC',
    name: 'IP address is invalid',
    level: 'warn',
    message: 'Valid address would be in xxx.xxx.xxx.xxx format',
    actions: []
},
{
    code: 'EMAIL_DMC',
    name: 'email is invalid',
    level: 'warn',
    message: 'Please enter a valid email',
    actions: []
},
{
    code: 'PHONE_DMC',
    name: 'phone is invalid',
    level: 'warn',
    message: 'Please enter a valid phone',
    actions: []
},
{
    code: 'BSSID_DMC',
    name: 'BSSID is invalid',
    level: 'warn',
    message: 'Please enter a valid BSSID',
    actions: []
},
{
    code: 'ORGANIZATION_NAME_DMC',
    name: 'name is invalid',
    level: 'warn',
    message: 'Please enter a valid name',
    actions: []
},
{
    code: 'NAME_DMC',
    name: 'name is invalid',
    level: 'warn',
    message: 'Please enter a valid name',
    actions: []
},
{
    code: 'PAN_DMC',
    name: 'PAN is invalid',
    level: 'warn',
    message: 'Please enter a valid PAN',
    actions: []
},
{
    code: 'GST_DMC',
    name: 'GST is invalid',
    level: 'warn',
    message: 'Please enter a valid GST',
    actions: []
},
{
    code: 'data-not-found',
    message: 'No Data Found',
    icon: 'error-no-data'
},
{
    code: 'component-not-found',
    message: 'Component does not exist',
    icon: 'error-no-data'
},
{
    code: 'TIMELOGS_NDF',
    message: 'No Time Log Found',
    icon: 'error-no-data'
},
{
    code: 'TASKS_DONE',
    icon: 'message-enjoy',
    message: 'All done for the day'
},
{
    code: 'TASKS_PLAN',
    icon: 'error-no-data',
    message: 'What do you plan to do next'
},
{
    code: 'TASKS_ADD',
    icon: 'error-no-data',
    message: 'Add some tasks'
},
{
    code: 'nothing-pending',
    icon: 'message-enjoy',
    message: 'You wrapped up everything'
},
{
    code: 'INPUT_INV',
    icon: 'error-invalid',
    message: 'Input type is invalid'
}]
