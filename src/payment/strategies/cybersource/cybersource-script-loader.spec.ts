import { createScriptLoader } from '@bigcommerce/script-loader';

import CybersourceScriptLoader from './cybersource-script-loader';

describe('CybersourceScriptLoader', () => {
    const scriptLoader = createScriptLoader();
    const cybersourceScriptLoader = new CybersourceScriptLoader(scriptLoader);

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
});
