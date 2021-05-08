export const reformatAuthResult = (authResult) => ({
	accessToken: authResult.access_token,
	expiresIn: authResult.expires_in,
	idToken: authResult.id_token,
	tokenType: authResult.token_type,
	scope: authResult.scope
});

export const mfaDefaultOptions = {
	challengeType: 'oob', // or 'otp'
	oobChannels: ['sms'],
	authenticatorTypes: ['oob'], // or ['otp']
	grantType: 'http://auth0.com/oauth/grant-type/mfa-oob'
};

class Auth0MultiFactorAuthentication {
	constructor(clientId, domain, options = mfaDefaultOptions) {
		this.clientId = clientId;
		this.domain = domain;
		this.url = `https://${domain}`;
		this.options = options;

		this.mfaToken = null;
		this.phoneNumber = null;
		this.otp = null;

		this.oobCode = null;
	}

	post(url, data, headers) {
		return new Promise((resolve) => {
			fetch(url, {
				method: 'POST',
				headers: {
					...headers,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(data)
			})
				.then((response) => {
					if (!response.ok) {
						throw response.json();
					}
					return response.json();
				})
				.then((data) => {
					resolve({data});
				})
				.catch((error) => error)
				// eslint-disable-next-line camelcase
				.then((data) => {
					const {error, error_description} = data || {}
					if (error) {
						resolve({
							error: {
								name: error,
								description: error_description
							}
						});
					}
				});
		});
	}

	async token() {
		const url = `${this.url}/oauth/token`;
		const {challengeType, grantType} = this.options;
		let input = {
			client_id: this.clientId,
			grant_type: grantType,
			mfa_token: this.mfaToken,
			challenge_type: challengeType
		};

		if (challengeType === 'oob') {
			input = {
				...input,
				oob_code: this.oobCode,
				binding_code: this.otp
			};
		}

		if (challengeType === 'otp') {
			input = {
				...input,
				otp: this.otp
			};
		}

		const {data, error} = await this.post(url, input);
		let errorDescription;
		if (error) {
			const {description} = error;
			errorDescription = description;
		}
		return {data, error: errorDescription};
	}

	async challenge() {
		const url = `${this.url}/mfa/challenge`;
		const {challengeType} = this.options;
		const input = {
			client_id: this.clientId,
			mfa_token: this.mfaToken,
			challenge_type: challengeType
		};

		const {data, error} = await this.post(url, input);
		if (error) {
			const {name, description} = error;
			/*
			{
				"error": "association_required",
				"error_description": "User does not have 
				any confirmed authenticator associated.
				You can associate a new authenticator
				calling /mfa/associate endpoint.
				If you have one authenticator ready
				for confirmation, you can confirm
				it just using it in /oauth/token"
			}
			*/
			if (name === 'association_required') {
				return this.enroll();
			}
			return {data: null, error: description};
		}

		if (challengeType === 'oob') {
			// eslint-disable-next-line camelcase
			const {oob_code} = data;
			// eslint-disable-next-line camelcase
			this.oobCode = oob_code;
		}

		return {data, error: null};
	}

	async enroll() {
		const url = `${this.url}/mfa/associate`;
		const {challengeType, oobChannels, authenticatorTypes} = this.options;
		let input = {
			client_id: this.clientId,
			authenticator_types: authenticatorTypes
		};

		if (challengeType === 'oob') {
			input = {
				...input,
				oob_channels: oobChannels
			};
			if (oobChannels.includes('voice') || oobChannels.includes('sms')) {
				if (!this.phoneNumber) {
					throw new Error('phone number is required');
				}
				input = {
					...input,
					phone_number: this.phoneNumber
				};
			}
		}

		const headers = {
			Authorization: `Bearer ${this.mfaToken}`
		};
		const {data, error} = await this.post(url, input, headers);
		if (error) {
			const {description} = error;
			if (this.isEnrolled(error)) {
				return this.challenge();
			}
			return {data: null, error: description};
		}

		if (challengeType === 'oob') {
			// eslint-disable-next-line camelcase
			const {oob_code} = data;
			// eslint-disable-next-line camelcase
			this.oobCode = oob_code;
		}

		return {data, error: null};
	}

	isEnrolled(data) {
		const {error, description} = data;
		// error: "access_denied", error_description: "User is already enrolled."
		if (
			error === 'access_denied' &&
			description.includes('already') &&
			description.includes('enrolled')
		) {
			return true;
		}
		return false;
	}

	start(mfaToken, phoneNumber) {
		this.mfaToken = mfaToken;
		this.phoneNumber = phoneNumber;
		return this.challenge();
	}

	complete(otp) {
		this.otp = otp;
		return this.token();
	}
}

export default Auth0MultiFactorAuthentication;
