import { CheckoutStore, InternalCheckoutSelectors } from '../../checkout';
import {
    InvalidArgumentError,
    MissingDataError,
    MissingDataErrorType,
    NotImplementedError
} from '../../common/error/errors';
import { PaymentInitializeOptions, PaymentMethod, PaymentMethodActionCreator } from '../../payment';
import GooglePayPaymentStrategy from '../../payment/strategies/googlepay/googlepay-payment-strategy';
import { RemoteCheckoutActionCreator } from '../../remote-checkout';
import CustomerCredentials from '../customer-credentials';
import { CustomerInitializeOptions, CustomerRequestOptions } from '../customer-request-options';

import CustomerStrategy from './customer-strategy';

export default class GooglePayBraintreeCustomerStrategy extends CustomerStrategy {
    private _signInButton?: HTMLElement;
    private _paymentMethod?: PaymentMethod;
     constructor(
        store: CheckoutStore,
        private _googlePayPaymentStrategy: GooglePayPaymentStrategy,
        private _paymentMethodActionCreator: PaymentMethodActionCreator,
        private _remoteCheckoutActionCreator: RemoteCheckoutActionCreator
    ) {
        super(store);
    }

    initialize(options: CustomerInitializeOptions): Promise<InternalCheckoutSelectors> {
        if (this._isInitialized) {
            return super.initialize(options);
        }

        const { googlepay: googlepayBraintree, methodId }  = options;

        if (!googlepayBraintree || !methodId) {
            throw new InvalidArgumentError();
        }

        return this._store.dispatch(this._paymentMethodActionCreator.loadPaymentMethod(methodId))
            .then(state => {
                const paymentMethod = this._paymentMethod = state.paymentMethods.getPaymentMethod(methodId);

                if (!paymentMethod || !paymentMethod.clientToken) {
                    throw new MissingDataError(MissingDataErrorType.MissingPaymentMethod);
                }

                if (this._googlePayPaymentStrategy) {
                    const paymentOptions: PaymentInitializeOptions = {
                        methodId,
                        googlepay: {
                            //walletButton: googlepayBraintree.container,
                            onPaymentSelect: this._onPaymentSelectComplete,
                            onError: this._onError,
                        },
                    };
                    this._googlePayPaymentStrategy.initialize(paymentOptions)
                        .then(() => this._createSignInButton(googlepayBraintree.container));
                }
            })
        .then(() => super.initialize(options));
    }

    deinitialize(options?: CustomerRequestOptions): Promise<InternalCheckoutSelectors> {
        if (!this._isInitialized) {
            return super.deinitialize(options);
        }
        this._paymentMethod = undefined;
        if (this._signInButton && this._signInButton.parentNode) {
            this._signInButton.parentNode.removeChild(this._signInButton);
            this._signInButton = undefined;
        }
        return super.deinitialize(options);
    }

    signIn(credentials: CustomerCredentials, options?: CustomerRequestOptions): Promise<InternalCheckoutSelectors> {
        throw new NotImplementedError(
            'In order to sign in via Google Pay, the shopper must click on "Google Pay" button.'
        );
    }

    signOut(options?: CustomerRequestOptions): Promise<InternalCheckoutSelectors> {
        const state = this._store.getState();
        const payment = state.payment.getPaymentId();
        if (!payment) {
            return Promise.resolve(this._store.getState());
        }
        return this._store.dispatch(
            this._remoteCheckoutActionCreator.signOut(payment.providerId, options)
        );
    }

    private _createSignInButton(containerId: string): void {
        const container = document.querySelector(`#${containerId}`);
        if (!container) {
            throw new InvalidArgumentError('Unable to create sign-in button without valid container ID.');
        }

        const googlePayButton = this._googlePayPaymentStrategy.createButton();

        // const button = document.createElement('input');
        // button.type = 'image';
        // button.src = 'https://static.masterpass.com/dyn/img/btn/global/mp_chk_btn_160x037px.svg';
        //button.src = '~/img/payment-providers/google-pay.png';
        container.appendChild(googlePayButton);
        // return button;
    }

    private _onPaymentSelectComplete(): void {
        return window.location.assign('/checkout.php');
    }

    private _onError(error?: Error): void {
        if (error) {
            throw new Error(error.message);
        }
    }
}
