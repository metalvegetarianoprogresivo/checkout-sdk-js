import { CardinalWindow, CyberSourceCardinal } from './cybersource';

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
