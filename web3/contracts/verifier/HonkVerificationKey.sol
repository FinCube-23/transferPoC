// SPDX-License-Identifier: Apache-2.0
pragma solidity >=0.8.21;

import "./HonkTypes.sol";

uint256 constant N = 65536;
uint256 constant LOG_N = 16;
uint256 constant NUMBER_OF_PUBLIC_INPUTS = 19;
uint256 constant VK_HASH = 0x1a94b2c862f2d87faabcbfa55725901a0a09bcb55f9b21b85b7608b10bfba026;

library HonkVerificationKey {
    function loadVerificationKey()
        internal
        pure
        returns (Honk.VerificationKey memory)
    {
        Honk.VerificationKey memory vk = Honk.VerificationKey({
            circuitSize: uint256(65536),
            logCircuitSize: uint256(16),
            publicInputsSize: uint256(19),
            ql: Honk.G1Point({
                x: uint256(
                    0x2cac5fb551d8b7293881e16e327180b996cae798f1abc5691ac59adf18f83ba8
                ),
                y: uint256(
                    0x22266233cd9cf4c630d96134f19091a8abb3853352dace69ff3943a71bb58ce7
                )
            }),
            qr: Honk.G1Point({
                x: uint256(
                    0x1de5be1c59aaabd204aad0f4c123cd896c959fda4f601e65c2de70c1cdd15bd0
                ),
                y: uint256(
                    0x0af1198e67daee2c7e046921c65a5fe8539e657c3c6b538d1574c326b244a910
                )
            }),
            qo: Honk.G1Point({
                x: uint256(
                    0x07795a7fac5b1dce5c9b79dbc9023585cd56cc97fa98ce94279fb4984de7d3f2
                ),
                y: uint256(
                    0x217ff1a9b27759494d9845b0c09d6ca387173549ec3bce78b2b481b519196d1b
                )
            }),
            q4: Honk.G1Point({
                x: uint256(
                    0x04dcc93bfa52d4be776e1226c917bb53b92d353766d3a3d08f00d6e160dc494a
                ),
                y: uint256(
                    0x05b3a07499120734cddb4820189c5d1ca6aa1e6251035cfccfe600aaa60d1cb8
                )
            }),
            qm: Honk.G1Point({
                x: uint256(
                    0x1d0c1dbed9197cfb5c057df09d88b51fcd4adc975ead65d1b0918b616117a24f
                ),
                y: uint256(
                    0x1da3647a396d51622a5015130e37f82144d5a1c0e922dbfdfcdc2d36541409db
                )
            }),
            qc: Honk.G1Point({
                x: uint256(
                    0x263eadf2e8f2ab94a86471775a05cc3256f97e1cef09bfee515303867f5fc905
                ),
                y: uint256(
                    0x00d1f69e549a659e5679e3a99601536b524b028c5da623901917c70c4835615f
                )
            }),
            qLookup: Honk.G1Point({
                x: uint256(
                    0x0073e7c223dd4f3e4734c4d9d9c9df394bd2eee2e12bac2fc49429a0443ec8b0
                ),
                y: uint256(
                    0x20fac57db30195c2427a75a4d67231c1d1c74c8f84f009ab21d3c88e9657403d
                )
            }),
            qArith: Honk.G1Point({
                x: uint256(
                    0x29e8ce09ac9d8668447ffa6a01e18a9db7286bc184a9c15c6a65026796a328fb
                ),
                y: uint256(
                    0x19821f713613869e25590ec0ba74e377f8fdde08dcf9b4d472f2ba75642cb1d2
                )
            }),
            qDeltaRange: Honk.G1Point({
                x: uint256(
                    0x1f9a4d74450f541c267ca9ddb9428fdfb0cac22c150f68c2cacd3bc1d66f7076
                ),
                y: uint256(
                    0x14527319d6565cbb8fb9e16fdd36a629ddf64e3935e78a61f95897497e047275
                )
            }),
            qElliptic: Honk.G1Point({
                x: uint256(
                    0x1405347eda185fd94edcc6d0a206dd491cf2912e5ea086f5d7610e0477827b57
                ),
                y: uint256(
                    0x0aea5deeec587c1fe560ff9a748442e8174e1c257823f3113ed76fc674839f66
                )
            }),
            qMemory: Honk.G1Point({
                x: uint256(
                    0x0fdc78cab0099ec2a635535e627ef9579cf991c91ca68f1471264919f4f544b4
                ),
                y: uint256(
                    0x15817bd6a09b4c6cb5d6d1789273f0e91cf0858471ace58f9740512bec954528
                )
            }),
            qNnf: Honk.G1Point({
                x: uint256(
                    0x10c54ef77209a1630b96ac64352dd0fb958ce8e7f4dea12814c2dad9c3e71580
                ),
                y: uint256(
                    0x088f277325b5ffdfea377c003b58da7ef84bf5941ec39d3c8ae0ace186869a2f
                )
            }),
            qPoseidon2External: Honk.G1Point({
                x: uint256(
                    0x08ebe541dfee703b335665f99ad6b6b338b2121a8c2ff2778f7b495204c42a2c
                ),
                y: uint256(
                    0x297d9fb0045e0eb02b11394e7829aabadce75d02a8bc314b160ed9d1e60ebc76
                )
            }),
            qPoseidon2Internal: Honk.G1Point({
                x: uint256(
                    0x2d8d4f547ab4835e26a1467bf02e817a3bcebc933b21aa9b7907690a1df62204
                ),
                y: uint256(
                    0x2ebff046bdb50cbe11206af789c50abf367cfeb2cf97c4be9d4d3db5f0b5420c
                )
            }),
            s1: Honk.G1Point({
                x: uint256(
                    0x1c2b97df2903316ef3a254377b53ec0a9f0cb9edda2b8b6abbd8a178734650e7
                ),
                y: uint256(
                    0x1da321e137cadc06ec2169b6a8fd523fac91157b5f2e65414eb44484953f39e1
                )
            }),
            s2: Honk.G1Point({
                x: uint256(
                    0x2bb3b163ba8171f40d4b733a837f40aefc60b184a120f2254f2bdd515298cf1b
                ),
                y: uint256(
                    0x2a14be347bcdb86b54351469f0cd3be583a59be7c03d329f45d28bc4a925f6bd
                )
            }),
            s3: Honk.G1Point({
                x: uint256(
                    0x0f7a8db00757a3fa18e48fa7a8eb66b064895b31bc9de888b611314cf0937f2f
                ),
                y: uint256(
                    0x27b37aefd9edfcfeb7c32cc29eeb7d69b436c6856ac488e44f9067373139307c
                )
            }),
            s4: Honk.G1Point({
                x: uint256(
                    0x186535e73edcf7055daaeb13a7f3d1693422a727cd9652dfc0176d139d8300e0
                ),
                y: uint256(
                    0x2f719b075f824e8d8df12b63262b8ce3616b2e6890372103b342e1535772c72b
                )
            }),
            t1: Honk.G1Point({
                x: uint256(
                    0x099e3bd5a0a00ab7fe18040105b9b395b5d8b7b4a63b05df652b0d10ef146d26
                ),
                y: uint256(
                    0x0015b8d2515d76e2ccec99dcd194592129af3a637f5a622a32440f860d1e2a7f
                )
            }),
            t2: Honk.G1Point({
                x: uint256(
                    0x1b917517920bad3d8bc01c9595092a222b888108dc25d1aa450e0b4bc212c37e
                ),
                y: uint256(
                    0x305e8992b148eedb22e6e992077a84482141c7ebe42000a1d58ccb74381f6d19
                )
            }),
            t3: Honk.G1Point({
                x: uint256(
                    0x13567e3b915c81013ada15236ba5cfa60111b440400b2bca37e2b1085e924a77
                ),
                y: uint256(
                    0x0148d22589b91f0d8f4674af5744dedafd63caea904b434e748f9713de8cc3d7
                )
            }),
            t4: Honk.G1Point({
                x: uint256(
                    0x043d063b130adfb37342af45d0155a28edd1a7e46c840d9c943fdf45521c64ce
                ),
                y: uint256(
                    0x261522c4089330646aff96736194949330952ae74c573d1686d9cb4a00733854
                )
            }),
            id1: Honk.G1Point({
                x: uint256(
                    0x1f6578a0b2b7cd0b0c82d977da4b8d0d20335396c5aefc925785dab64b78f391
                ),
                y: uint256(
                    0x1cb01b48b7a197f3b22dcf7d6d060d12c8cca21ad660195a2054098c4d52efd3
                )
            }),
            id2: Honk.G1Point({
                x: uint256(
                    0x2c61aaac620cc999b498de69152ae17a1e81d123e5ba59fecf41c45fc662fc34
                ),
                y: uint256(
                    0x0bbb553b034882a11333d0bdea431b98bb39d9fa4893d19216af7655527b7249
                )
            }),
            id3: Honk.G1Point({
                x: uint256(
                    0x3059f0676ee05267636bb6bcde915f0819fba6019d08c8a46f17fe5fbbc9dbbb
                ),
                y: uint256(
                    0x0dd28b9f91c131162e9a41f9bb2fe5efff0398ecc30693037e6cbcb484ba5d96
                )
            }),
            id4: Honk.G1Point({
                x: uint256(
                    0x1a940c100bca2ad4c2dbb58f3c184122094f1385b0008b6514232a3ab5719ab8
                ),
                y: uint256(
                    0x1cc1669c97ba83c83a4837963265e41be2bb6a972f86450da99705118f2c7517
                )
            }),
            lagrangeFirst: Honk.G1Point({
                x: uint256(
                    0x0000000000000000000000000000000000000000000000000000000000000001
                ),
                y: uint256(
                    0x0000000000000000000000000000000000000000000000000000000000000002
                )
            }),
            lagrangeLast: Honk.G1Point({
                x: uint256(
                    0x031c3454763c6ab0f1a9d8ce1e75daf441c42b9bd07950f389c798ac17269fd6
                ),
                y: uint256(
                    0x2d519b3ed91b639193fae103b93ba289985efdaa05171e72940b375f851ae3c3
                )
            })
        });
        return vk;
    }
}
