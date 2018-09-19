import { StandardError } from '../../../common/error/errors';
import { BraintreeError } from '../../../payment/strategies/braintree';

export type EnvironmentType = 'PRODUCTION' | 'TEST';
export type ButtonColorType = 'black' | 'white';
export type ButtonTypeType = 'long' | 'short';

export interface GooglePayBraintreeButtonInitializeOptions {
    /**
     * The ID of a container which the checkout button should be inserted.
     */
    container: string;

    /**
     * This one is used to set the environment of Braintree. Default is 'PRODUCTION'
     */
    environment?: EnvironmentType;

    /**
     * The color of the GooglePay button that will be inserted.
     *  black (default): a black button suitable for use on white or light backgrounds.
     *  white: a white button suitable for use on colorful backgrounds.
     */
    buttonColor?: ButtonColorType;

    /**
     * The size of the GooglePay button that will be inserted.
     *  long: "Buy with Google Pay" button (default). A translated button label may appear
     *         if a language specified in the viewer's browser matches an available language.
     *  short: Google Pay payment button without the "Buy with" text.
     */
    buttonType?: ButtonTypeType;

    /**
     * A callback that gets called if unable to authorize and tokenize payment.
     *
     * @param error - The error object describing the failure.
     */
    onAuthorizeError?(error: BraintreeError | StandardError): void;

    /**
     * A callback that gets called if unable to submit payment.
     *
     * @param error - The error object describing the failure.
     */
    onPaymentError?(error: BraintreeError | StandardError): void;
}
