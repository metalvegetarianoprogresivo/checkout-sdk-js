import { FormPoster } from '@bigcommerce/form-poster';

import { Checkout, CheckoutActionCreator, CheckoutStore } from '../../../checkout';
import { InvalidArgumentError, MissingDataError, MissingDataErrorType } from '../../../common/error/errors';
import { bindDecorator as bind } from '../../../common/utility';
import { PaymentInitializeOptions, PaymentMethod, PaymentMethodActionCreator } from '../../../payment';
import { GooglePayAddress, GooglePayBraintreeSDK, GooglePayPaymentOptions, GooglePayPaymentStrategy, GooglePayScriptLoader, GooglePaySDK } from '../../../payment/strategies/googlepay';
import GooglePayPaymentProcessor from '../../../payment/strategies/googlepay/googlepay-payment-processor';
import { CheckoutButtonInitializeOptions, CheckoutButtonOptions } from '../../checkout-button-options';
import CheckoutButtonStrategy from '../checkout-button-strategy';

import { GooglePayBraintreeButtonInitializeOptions } from './googlepay-braintree-button-options';

export default class GooglePayBraintreeButtonStrategy extends CheckoutButtonStrategy {
    private _paymentMethod?: PaymentMethod;
    private _methodId!: string;
    private _checkout?: Checkout;
    private _walletButton?: HTMLElement;

    constructor(
        private _store: CheckoutStore,
        private _formPoster: FormPoster,
        private _googlePayScriptLoader: GooglePayScriptLoader,
        private _checkoutActionCreator: CheckoutActionCreator,
        private _paymentMethodActionCreator: PaymentMethodActionCreator,
        private _googlePayPaymentProcessor: GooglePayPaymentProcessor
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

        return this._googlePayPaymentProcessor.initialize(methodId)
            .then(() => {
                const walletButton = this._createSignInButton(googlepaybraintree.container);

                if (walletButton) {
                    this._walletButton = walletButton;
                    this._walletButton.addEventListener('click', this._handleWalletButtonClick);
                }
            })
            .then(() => super.initialize(options));
    }

    // initialize(options: CheckoutButtonInitializeOptions): Promise<void> {
    //     if (this._isInitialized) {
    //         return super.initialize(options);
    //     }

    //     const { googlepaybraintree, methodId } = options;

    //     if (!googlepaybraintree || !methodId) {
    //         throw new MissingDataError(MissingDataErrorType.MissingPaymentMethod);
    //     }

    //     this._methodId = methodId;

    //     return this._store.dispatch(this._checkoutActionCreator.loadDefaultCheckout())
    //         .then(stateCheckout => {
    //             this._checkout = stateCheckout.checkout.getCheckout();
    //             if (!this._checkout || !this._checkout.cart.id) {
    //                 throw new MissingDataError(MissingDataErrorType.MissingCart);
    //             }

    //             this._paymentMethod = stateCheckout.paymentMethods.getPaymentMethod(methodId);
    //             if (!this._paymentMethod || !this._paymentMethod.initializationData) {
    //                 throw new MissingDataError(MissingDataErrorType.MissingPaymentMethod);
    //             }

    //             return this._googlePayPaymentProcessor.initialize(this._methodId)
    //                 .then(() => this._googlePayPaymentProcessor.createButton(this._handleWalletButtonClick));

    //     }).then(() => super.initialize(options));
    // }

    deinitialize(options: CheckoutButtonOptions): Promise<void> {
        if (!this._isInitialized) {
            return super.deinitialize(options);
        }

        this._paymentMethod = undefined;

        return this._googlePayPaymentProcessor.deinitialize()
            .then(() => super.deinitialize(options));
    }

    private _createSignInButton(containerId: string): HTMLElement {
        const container = document.querySelector(`#${containerId}`);

        if (!container) {
            throw new InvalidArgumentError('Unable to create sign-in button without valid container ID.');
        }

        const googlePayButton = this._googlePayPaymentProcessor.createButton(() => this._onPaymentSelectComplete);

        container.appendChild(googlePayButton);

        return googlePayButton;
    }

    private _createGooglePayButton(googleClientOptions: GooglePayPaymentOptions, googlepaybraintree: GooglePayBraintreeButtonInitializeOptions): Promise<void> {
        return this._googlePayScriptLoader.load()
            .then(googleSDK => {
                const googleClient = new googleSDK.payments.api.PaymentsClient(googleClientOptions);

                const googlePayButton = googleClient.createButton({});
                const container = document.querySelector(`#${googlepaybraintree.container}`);

                if (!container) {
                    throw new InvalidArgumentError('Unable to create sign-in button without valid container ID.');
                }

                container.appendChild(googlePayButton);
            });
    }

    @bind
    private _handleWalletButtonClicked(): Promise<void> {
        return this._googlePayPaymentProcessor.displayWallet()
            .then(() => this._onPaymentSelectComplete());
    }

    @bind
    private _handleWalletButtonClick(event: Event): Promise<void> {
        event.preventDefault();

        let billingAddress: GooglePayAddress;
        let shippingAddress: GooglePayAddress;

        return this._googlePayPaymentProcessor.displayWallet()
            .then(paymentData => {
                billingAddress = paymentData.cardInfo.billingAddress;
                shippingAddress = paymentData.shippingAddress;
                return this._googlePayPaymentProcessor.handleSuccess(paymentData);
            })
            .then(() => {
                return Promise.all([
                    this._googlePayPaymentProcessor.updateBillingAddress(billingAddress),
                    // this._googlePayPaymentProcessor.updateShippingAddress(shippingAddress),
                ]).then(() => this._onPaymentSelectComplete());
            });
    }

    private _onPaymentSelectComplete(): void {
        this._formPoster.postForm('/checkout.php', {
            headers: {
                Accept: 'text/html',
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });
    }

    private _onError(error?: Error): void {
        if (error) {
            throw new Error(error.message);
        }
    }

}
