import { FormPoster } from '@bigcommerce/form-poster';

import { Checkout, CheckoutActionCreator, CheckoutStore } from '../../../checkout';
import { InvalidArgumentError, MissingDataError, MissingDataErrorType } from '../../../common/error/errors';
import { bindDecorator as bind } from '../../../common/utility';
import { PaymentInitializeOptions, PaymentMethod, PaymentMethodActionCreator } from '../../../payment';
import { GooglePayBraintreeSDK, GooglePayPaymentOptions, GooglePayPaymentStrategy, GooglePayScriptLoader, GooglePaySDK, EnvironmentType } from '../../../payment/strategies/googlepay';
import GooglePayPaymentProcessor from '../../../payment/strategies/googlepay/googlepay-payment-processor';
import { CheckoutButtonInitializeOptions, CheckoutButtonOptions } from '../../checkout-button-options';
import CheckoutButtonStrategy from '../checkout-button-strategy';

import { GooglePayBraintreeButtonInitializeOptions } from './googlepay-braintree-button-options';
import { env } from 'shelljs';

export default class GooglePayBraintreeButtonStrategy extends CheckoutButtonStrategy {
    private _paymentMethod?: PaymentMethod;
    private _methodId!: string;
    private _checkout?: Checkout;

    constructor(
        private _store: CheckoutStore,
        private _formPoster: FormPoster,
        private _googlePayScriptLoader: GooglePayScriptLoader,
        private _checkoutActionCreator: CheckoutActionCreator,
        private _paymentMethodActionCreator: PaymentMethodActionCreator
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

        this._methodId = methodId;
        const environment: EnvironmentType = (googlepaybraintree.environment) ? googlepaybraintree.environment : 'TEST';

        this._createGooglePayButton({ environment }, googlepaybraintree);

        return this._store.dispatch(this._checkoutActionCreator.loadDefaultCheckout())
            .then(stateCheckout => {
                this._checkout = stateCheckout.checkout.getCheckout();
                if (!this._checkout || !this._checkout.cart.id) {
                    throw new MissingDataError(MissingDataErrorType.MissingCart);
                }

                // return this._googlePayPaymentProcessor.initialize(this._methodId)
                //     .then(() => this._googlePayPaymentProcessor.createButton(this._handleWalletButtonClick));

        }).then(() => super.initialize(options));
    }

    deinitialize(options: CheckoutButtonOptions): Promise<void> {
        if (!this._isInitialized) {
            return super.deinitialize(options);
        }

        this._paymentMethod = undefined;

        return super.deinitialize(options);

        // return this._googlePayPaymentProcessor.deinitialize()
        //     .then(() => super.deinitialize(options));
    }

    private _createGooglePayButton(googleClientOptions: GooglePayPaymentOptions, googlepaybraintree: GooglePayBraintreeButtonInitializeOptions): Promise<void> {
        return this._googlePayScriptLoader.load()
            .then(googleSDK => {
                const googleClient = new googleSDK.payments.api.PaymentsClient(googleClientOptions);

                const googlePayButton = googleClient.createButton({
                    onClick: this._handleWalletButtonClick,
                    buttonSize: (googlepaybraintree.buttonType) ? googlepaybraintree.buttonType : 'long',
                });
                const container = document.querySelector(`#${googlepaybraintree.container}`);

                if (!container) {
                    throw new InvalidArgumentError('Unable to create sign-in button without valid container ID.');
                }

                container.appendChild(googlePayButton);
            });
    }

    @bind
    private _handleWalletButtonClick(): Promise<void> {
        return Promise.resolve()
            .then(() => this._onPaymentSelectComplete());
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
