import { expect, test } from 'vitest'
import { finishNormalize } from "../../lib/scoring/normalize";

test('Test remove apostrophe and keep s', () => {
    expect(finishNormalize("assassin's")).toBe("assassins")
    expect(finishNormalize("marvel's")).toBe("marvels")
    expect(finishNormalize("world's")).toBe("worlds")
})

test('Test french remove possessive word in front', () => {
    expect(finishNormalize("L'Ennui")).toBe("ennui")
})