import { FormPoster } from '@bigcommerce/form-poster';

import { CheckoutStore } from '../../../checkout';
import { InvalidArgumentError, MissingDataError, MissingDataErrorType } from '../../../common/error/errors';
import { PaymentInitializeOptions, PaymentMethod } from '../../../payment';
import { GooglePayPaymentOptions, GooglePayPaymentStrategy, GooglePayScriptLoader } from '../../../payment/strategies/googlepay';
import { CheckoutButtonInitializeOptions, CheckoutButtonOptions } from '../../checkout-button-options';

import CheckoutButtonStrategy from '../checkout-button-strategy';

export default class GooglePayBraintreeButtonStrategy extends CheckoutButtonStrategy {
    private _paymentMethod?: PaymentMethod;

    constructor(
        private _store: CheckoutStore,
        private _formPoster: FormPoster,
        private _googlePayScriptLoader: GooglePayScriptLoader,
        private _googlePayPaymentStrategy: GooglePayPaymentStrategy
    ) {
        super();
    }

    initialize(options: CheckoutButtonInitializeOptions): Promise<void> {
        if (this._isInitialized) {
            return super.initialize(options);
        }

        const { googlepaybraintree, methodId } = options;

        if (!googlepaybraintree || !methodId) {
            throw new MissingDataError(MissingDataErrorType.MissingPaymentMethod);
        }

        const paymentOptions: PaymentInitializeOptions = {
            methodId,
            googlepay: {
                onPaymentSelect: this._onPaymentSelectComplete,
                onError: this._onError,
            },
        };

        const googleClientOptions: GooglePayPaymentOptions = {
            environment: googlepaybraintree.environment || 'PRODUCTION',
        };

        return this._googlePayScriptLoader.load()
            .then(googleSDK => {
                const googleClient = new googleSDK.payments.api.PaymentsClient(googleClientOptions);

                const googlePayButton = googleClient.createButton({
                    onClick: () => {},
                });
                const container = document.querySelector(`#${googlepaybraintree.container}`);

                if (!container) {
                    throw new InvalidArgumentError('Unable to create sign-in button without valid container ID.');
                }

                container.appendChild(googlePayButton);
            })
            .then(() => super.initialize(options));

        // const processorOptions: GooglePayProcessorOptions = {
        //     initializeOptions: paymentOptions,
        // };

        // return this._googlePayPaymentProcessor.initialize(processorOptions)
        //     .then(() => { this._createSignInButton(googlepaybraintree.container); })
        //     .then(() => super.initialize(options));
    }

    deinitialize(options: CheckoutButtonOptions): Promise<void> {
        if (!this._isInitialized) {
            return super.deinitialize(options);
        }

        this._paymentMethod = undefined;

        return super.deinitialize(options);
    }

    private _createSignInButton(containerId: string): void {
        const container = document.querySelector(`#${containerId}`);

        if (!container) {
            throw new InvalidArgumentError('Unable to create sign-in button without valid container ID.');
        }

        // const googlePayButton = this._googlePayPaymentProcessor.createButton();

        // container.appendChild(googlePayButton);
    }

    private _onPaymentSelectComplete(): void {
        this._formPoster.postForm('/checkout.php', {
            headers: {
                Accept: 'text/html',
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            params: {
                fromGooglePay: true,
            },
        });
    }

    private _onError(error?: Error): void {
        if (error) {
            throw new Error(error.message);
        }
    }

}
