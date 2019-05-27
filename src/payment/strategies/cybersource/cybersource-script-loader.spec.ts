import { createScriptLoader } from '@bigcommerce/script-loader';

import CybersourceScriptLoader from './cybersource-script-loader';
import { StandardError } from '../../../common/error/errors';
import { CardinalWindow, CyberSourceCardinal } from './cybersource';

describe('CybersourceScriptLoader', () => {
    const scriptLoader = createScriptLoader();
    const cybersourceScriptLoader = new CybersourceScriptLoader(scriptLoader);
    let cardinalWindow: CardinalWindow;

    beforeEach(() => {
        jest.spyOn(scriptLoader, 'loadScript').mockReturnValue(Promise.resolve(true));
    });

    it('loads widget test script', () => {
        const testMode = true;
        cybersourceScriptLoader.load(testMode);

        expect(scriptLoader.loadScript).toHaveBeenCalledWith(
            'https://songbirdstag.cardinalcommerce.com/edge/v1/songbird.js'
        );
    });

    it('loads widget production script', () => {
        const testMode = false;
        cybersourceScriptLoader.load(testMode);

        expect(scriptLoader.loadScript).toHaveBeenCalledWith(
            'https://songbird.cardinalcommerce.com/edge/v1/songbird.js'
        );
    });

    it('throws error to inform that order finalization is not required', async () => {
        try {
            await cybersourceScriptLoader.load();
        } catch (error) {
            expect(error).toBeInstanceOf(StandardError);
        }
    });

    // it('throws error to inform that order finalization is not required', async () => {
    //     scriptLoader.loadScript = jest.fn(() => {
    //         if (cardinalWindow.window) {
    //             // mockWindow.braintree.googlePayment = undefined;
    //             // mockWindow.braintree = undefined;
    //             return Promise.resolve();
    //         }
    //     });

    //     try {
    //         await cybersourceScriptLoader.load();
    //     } catch (error) {
    //         expect(error).toBeInstanceOf(StandardError);
    //     }
    // });
    // 24
});
