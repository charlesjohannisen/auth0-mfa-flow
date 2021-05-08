# auth0-mfa-flow

Used in conjunction with https://github.com/auth0/auth0.js \
If you have multi-factor authentication enabled auth0-js will lead to a dead-end.\
Use this library to continue the auhtentication process.\
This library only favours mfa via sms, voice or other otp delivery at this point.

# Usage
```js
import auth0 from 'auth0-js';
import Auth0MFAFlow from 'auth0-mfa-flow';

const clientId = 'YOUR_AUTH0_APPLICATION_CLIENT_ID';
const domain = 'YOUR_AUTH0_APLLICATION_DOMAIN';

const auth = new auth0.Authentication({
  doamin,
  clientID: clientId,
  scope: 'openid profile email',
  responseType: 'code'
});

const mfaAuth = new Auth0MFAFLow(clientId, domain);

const startMultiFactorAuth = (mfaToken) => {
	// SHOW MOBILE NUMBER INPUT FIELD
	const mobileNumber = 'GET_THE_USER_MOBILE_NUMBER'; // OPTIONAL for oob ( sms or voice )
	// get the mobile number from the user if required
	const {error} = mfaAuth.start(mfaToken, mobileNumber);
	if (!error) {
		// SHOW OTP INPUT FIELD
		// once user enters OTP and submits form, call onOtpSubmit
	} else {
		// SHOW ERROR MESSAGE
	}
};

const onOtpSubmit = async (otp) => {
	const {data} = await mfaAuth.complete(otp);
	if (data) {
		// data contains your access_token
		auth.userInfo(data.access_token, async (error, profile) => {
		
		});
	} else {
		// SHOW ERROR MESSAGE
	}
};

auth.login(
	{
		realm: 'Username-Password-Authentication',
		username: 'AUTH0_USER_USERNAME_FROM_USER_INPUT',
		password: 'AUTH0_USER_PASSWORD_FROM_USER_INPUT'
	},
	async (err, authResult) => {
		if (err || !authResult) {
			if (err) {
				const {code, original} = err;
				if (code === 'mfa_required') {
					// with multi-factor enabled
					const {
						response: {
							body: {mfa_token}
						}
					} = original;
					startMultiFactorAuth(mfa_token);
				}
			}
		} else {
			// without multi-factor enabled
			auth.userInfo(authResult.accessToken, async (error, profile) => {
		
			});
		}
	}
);
```