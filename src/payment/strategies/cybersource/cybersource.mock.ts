import {
    CardinalEventAction,
    CardinalEventResponse,
    CardinalPaymentStep, CardinalValidatedAction,
    CardinalValidatedData,
    CardinalWindow,
    CyberSourceCardinal, Payment, PaymentType
} from './cybersource';

const CardinalWindowMock: CardinalWindow = window;

export function getCyberSourceScriptMock(): CardinalWindow {
    return {
        ... CardinalWindowMock,
        Cardinal: {
            configure: jest.fn(),
            on: jest.fn(),
            setup: jest.fn(),
            trigger: jest.fn(),
            continue: jest.fn(),
        },
    };
}

export function getCyberSourceCardinal(): CyberSourceCardinal {
    return {
        configure: jest.fn(),
        on: jest.fn(),
        setup: jest.fn(),
        trigger: jest.fn(),
        continue: jest.fn(),
    };
}

export function getRejectAuthorizationPromise(): CardinalEventResponse {
    return {
        type: {
            step: CardinalPaymentStep.AUTHORIZATION,
            action: CardinalEventAction.OK,
        },
        jwt: '',
        data: {
            ActionCode: CardinalValidatedAction.SUCCCESS,
            ErrorDescription: 'error',
            ErrorNumber: 200,
            Validated: true,
            Payment: {
                ProcessorTransactionId: '',
                Type: PaymentType.CCA,
            },
        },
        status: true,
    };
}
