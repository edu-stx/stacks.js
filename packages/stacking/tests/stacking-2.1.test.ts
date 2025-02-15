import { hexToBytes } from '@stacks/common';
import { StacksMainnet, StacksTestnet } from '@stacks/network';
import { ContractCallPayload } from '@stacks/transactions';
import { deserializeTransaction, getNonce } from '@stacks/transactions';

import { decodeBtcAddress, StackingClient } from '../src';
import { PoxOperationPeriod } from '../src/constants';
import {
  getFetchMockBroadcast,
  MOCK_EMPTY_ACCOUNT,
  MOCK_FULL_ACCOUNT,
  MOCK_POX_2_REGTEST,
  setApiMocks,
  V2_POX_INTERFACE_POX_2,
  waitForBlock,
  waitForCycle,
  waitForTx,
} from './apiMockingHelpers';
import { BTC_ADDRESS_CASES } from './utils.test';

const API_URL = 'http://localhost:3999'; // default regtest url

// HOW-TO: Run tests unmocked (e.g. with a local regtest environment)
// * Add a root-level `jest.setTimeout(240_000);` with a high value to the file (outside of describe/test/before's)
// * Add `fetchMock.dontMock();` to any test that should NOT be mocked and will use the regtest

beforeEach(() => {
  jest.resetModules();
  fetchMock.resetMocks();
});

describe('2.1 period detection', () => {
  test('period 1 -- before 2.1 fork (mainnet)', async () => {
    setApiMocks({
      '/v2/pox': `{"contract_id":"SP000000000000000000002Q6VF78.pox","pox_activation_threshold_ustx":66818426279656,"first_burnchain_block_height":666050,"prepare_phase_block_length":100,"reward_phase_block_length":2000,"reward_slots":4000,"rejection_fraction":25,"total_liquid_supply_ustx":1336368525593131,"current_cycle":{"id":42,"min_threshold_ustx":140000000000,"stacked_ustx":528062660869340,"is_pox_active":true},"next_cycle":{"id":43,"min_threshold_ustx":120000000000,"min_increment_ustx":66818426279,"stacked_ustx":441243465796508,"prepare_phase_start_block_height":756250,"blocks_until_prepare_phase":182,"reward_phase_start_block_height":756350,"blocks_until_reward_phase":282,"ustx_until_pox_rejection":334092131398275},"min_amount_ustx":120000000000,"prepare_cycle_length":100,"reward_cycle_id":42,"reward_cycle_length":2100,"rejection_votes_left_required":334092131398275,"next_reward_cycle_in":282}`,
    });

    const network = new StacksMainnet();
    const client = new StackingClient('', network);

    const periodInfo = await client.getPoxOperationInfo();
    expect(periodInfo.period).toBe('Period1');
    expect(periodInfo.period).toBe(PoxOperationPeriod.Period1);
    expect(periodInfo.pox1.contract_id).toBe('SP000000000000000000002Q6VF78.pox');
  });

  test('period 1 -- before 2.1 fork (next/regtest)', async () => {
    setApiMocks({
      '/v2/pox': `{"contract_id":"ST000000000000000000002AMW42H.pox","pox_activation_threshold_ustx":600057388429055,"first_burnchain_block_height":0,"current_burnchain_block_height":108,"prepare_phase_block_length":1,"reward_phase_block_length":4,"reward_slots":8,"rejection_fraction":3333333333333333,"total_liquid_supply_ustx":60005738842905579,"current_cycle":{"id":21,"min_threshold_ustx":1875180000000000,"stacked_ustx":0,"is_pox_active":false},"next_cycle":{"id":22,"min_threshold_ustx":1875180000000000,"min_increment_ustx":7500717355363,"stacked_ustx":0,"prepare_phase_start_block_height":109,"blocks_until_prepare_phase":1,"reward_phase_start_block_height":110,"blocks_until_reward_phase":2,"ustx_until_pox_rejection":8484139029839119787},"min_amount_ustx":1875180000000000,"prepare_cycle_length":1,"reward_cycle_id":21,"reward_cycle_length":5,"rejection_votes_left_required":8484139029839119787,"next_reward_cycle_in":2,"contract_versions":[{"contract_id":"ST000000000000000000002AMW42H.pox","activation_burnchain_block_height":0,"first_reward_cycle_id":0},{"contract_id":"ST000000000000000000002AMW42H.pox-2","activation_burnchain_block_height":120,"first_reward_cycle_id":25}]}`,
      '/v2/data_var/ST000000000000000000002AMW42H/pox-2/configured?proof=0': `Data var not found`, // 404
    });

    const network = new StacksTestnet({ url: API_URL });
    const client = new StackingClient('', network);

    const poxInfo = await client.getPoxInfo();
    expect(poxInfo.contract_id).toBe('ST000000000000000000002AMW42H.pox');

    const periodInfo = await client.getPoxOperationInfo();
    expect(periodInfo.period).toBe('Period1');
    expect(periodInfo.period).toBe(PoxOperationPeriod.Period1);
    expect(periodInfo.pox1.contract_id).toBe('ST000000000000000000002AMW42H.pox');
  });

  test('period 2a -- after 2.1 fork, before v1 unlock', async () => {
    setApiMocks({
      '/v2/pox': `{"contract_id":"ST000000000000000000002AMW42H.pox","pox_activation_threshold_ustx":600057388429055,"first_burnchain_block_height":0,"current_burnchain_block_height":111,"prepare_phase_block_length":1,"reward_phase_block_length":4,"reward_slots":8,"rejection_fraction":3333333333333333,"total_liquid_supply_ustx":60005738842905579,"current_cycle":{"id":22,"min_threshold_ustx":1875180000000000,"stacked_ustx":0,"is_pox_active":false},"next_cycle":{"id":23,"min_threshold_ustx":1875180000000000,"min_increment_ustx":7500717355363,"stacked_ustx":0,"prepare_phase_start_block_height":114,"blocks_until_prepare_phase":3,"reward_phase_start_block_height":115,"blocks_until_reward_phase":4,"ustx_until_pox_rejection":8484139029839119787},"min_amount_ustx":1875180000000000,"prepare_cycle_length":1,"reward_cycle_id":22,"reward_cycle_length":5,"rejection_votes_left_required":8484139029839119787,"next_reward_cycle_in":4,"contract_versions":[{"contract_id":"ST000000000000000000002AMW42H.pox","activation_burnchain_block_height":0,"first_reward_cycle_id":0},{"contract_id":"ST000000000000000000002AMW42H.pox-2","activation_burnchain_block_height":120,"first_reward_cycle_id":25}]}`,
      '/v2/data_var/ST000000000000000000002AMW42H/pox-2/configured?proof=0': `{"data":"0x03"}`,
    });

    const network = new StacksTestnet({ url: API_URL });
    const client = new StackingClient('', network);

    const poxInfo = await client.getPoxInfo();
    expect(poxInfo.contract_id).toBe('ST000000000000000000002AMW42H.pox');

    const periodInfo = await client.getPoxOperationInfo();
    if (periodInfo.period === PoxOperationPeriod.Period1) throw Error;

    expect(periodInfo.period).toBe('Period2a');
    expect(periodInfo.period).toBe(PoxOperationPeriod.Period2a);
    expect(periodInfo.pox1.contract_id).toBe('ST000000000000000000002AMW42H.pox');
    expect(periodInfo.pox2.contract_id).toBe('ST000000000000000000002AMW42H.pox-2');
    expect(periodInfo.pox2.activation_burnchain_block_height).toBe(120);
    expect(periodInfo.pox2.first_reward_cycle_id).toBe(25);
  });

  test('period 2b -- after 2.1 fork, before first pox-2 cycle', async () => {
    setApiMocks({
      '/v2/pox': `{"contract_id":"ST000000000000000000002AMW42H.pox-2","pox_activation_threshold_ustx":600057388429055,"first_burnchain_block_height":0,"current_burnchain_block_height":121,"prepare_phase_block_length":1,"reward_phase_block_length":4,"reward_slots":8,"rejection_fraction":3333333333333333,"total_liquid_supply_ustx":60005738842905579,"current_cycle":{"id":24,"min_threshold_ustx":1875180000000000,"stacked_ustx":0,"is_pox_active":false},"next_cycle":{"id":25,"min_threshold_ustx":1875180000000000,"min_increment_ustx":7500717355363,"stacked_ustx":0,"prepare_phase_start_block_height":124,"blocks_until_prepare_phase":3,"reward_phase_start_block_height":125,"blocks_until_reward_phase":4,"ustx_until_pox_rejection":8484139029839119787},"min_amount_ustx":1875180000000000,"prepare_cycle_length":1,"reward_cycle_id":24,"reward_cycle_length":5,"rejection_votes_left_required":8484139029839119787,"next_reward_cycle_in":4,"contract_versions":[{"contract_id":"ST000000000000000000002AMW42H.pox","activation_burnchain_block_height":0,"first_reward_cycle_id":0},{"contract_id":"ST000000000000000000002AMW42H.pox-2","activation_burnchain_block_height":120,"first_reward_cycle_id":25}]}`,
      '/v2/data_var/ST000000000000000000002AMW42H/pox-2/configured?proof=0': `{"data":"0x03"}`,
    });

    const network = new StacksTestnet({ url: API_URL });
    const client = new StackingClient('', network);

    const poxInfo = await client.getPoxInfo();
    expect(poxInfo.contract_id).toBe('ST000000000000000000002AMW42H.pox-2');

    const periodInfo = await client.getPoxOperationInfo();
    if (periodInfo.period === PoxOperationPeriod.Period1) throw Error;

    expect(periodInfo.period).toBe('Period2b');
    expect(periodInfo.period).toBe(PoxOperationPeriod.Period2b);
    expect(periodInfo.pox1.contract_id).toBe('ST000000000000000000002AMW42H.pox');
    expect(periodInfo.pox2.contract_id).toBe('ST000000000000000000002AMW42H.pox-2');
    expect(periodInfo.pox2.activation_burnchain_block_height).toBe(120);
    expect(periodInfo.pox2.first_reward_cycle_id).toBe(25);
  });

  test('period 3', async () => {
    setApiMocks({
      '/v2/pox': `{"contract_id":"ST000000000000000000002AMW42H.pox-2","pox_activation_threshold_ustx":600057388429055,"first_burnchain_block_height":0,"current_burnchain_block_height":126,"prepare_phase_block_length":1,"reward_phase_block_length":4,"reward_slots":8,"rejection_fraction":3333333333333333,"total_liquid_supply_ustx":60005738842905579,"current_cycle":{"id":25,"min_threshold_ustx":1875180000000000,"stacked_ustx":0,"is_pox_active":false},"next_cycle":{"id":26,"min_threshold_ustx":1875180000000000,"min_increment_ustx":7500717355363,"stacked_ustx":0,"prepare_phase_start_block_height":129,"blocks_until_prepare_phase":3,"reward_phase_start_block_height":130,"blocks_until_reward_phase":4,"ustx_until_pox_rejection":8484139029839119787},"min_amount_ustx":1875180000000000,"prepare_cycle_length":1,"reward_cycle_id":25,"reward_cycle_length":5,"rejection_votes_left_required":8484139029839119787,"next_reward_cycle_in":4,"contract_versions":[{"contract_id":"ST000000000000000000002AMW42H.pox","activation_burnchain_block_height":0,"first_reward_cycle_id":0},{"contract_id":"ST000000000000000000002AMW42H.pox-2","activation_burnchain_block_height":120,"first_reward_cycle_id":25}]}`,
      '/v2/data_var/ST000000000000000000002AMW42H/pox-2/configured?proof=0': `{"data":"0x03"}`,
    });

    const network = new StacksTestnet({ url: API_URL });
    const client = new StackingClient('', network);

    const poxInfo = await client.getPoxInfo();
    expect(poxInfo.contract_id).toBe('ST000000000000000000002AMW42H.pox-2');

    const periodInfo = await client.getPoxOperationInfo();
    if (periodInfo.period === PoxOperationPeriod.Period1) throw Error;

    expect(periodInfo.period).toBe('Period3');
    expect(periodInfo.period).toBe(PoxOperationPeriod.Period3);
    expect(periodInfo.pox1.contract_id).toBe('ST000000000000000000002AMW42H.pox');
    expect(periodInfo.pox2.contract_id).toBe('ST000000000000000000002AMW42H.pox-2');
    expect(periodInfo.pox2.activation_burnchain_block_height).toBe(120);
    expect(periodInfo.pox2.first_reward_cycle_id).toBe(25);
  });

  test('periods, block-by-block', async () => {
    // Assuming STACKS_21_HEIGHT=110
    // Assuming v1_unlock_height=STACKS_POX2_HEIGHT=120
    // Assuming reward_cycle_length=5 (making reward cycle 25 the first PoX-2 cycle, starting on block height 126)

    const network = new StacksTestnet({ url: API_URL });
    const client = new StackingClient('', network);

    await waitForBlock(106);
    setApiMocks({
      '/v2/pox': `{"contract_id":"ST000000000000000000002AMW42H.pox","pox_activation_threshold_ustx":600057110651278,"first_burnchain_block_height":0,"current_burnchain_block_height":106,"prepare_phase_block_length":1,"reward_phase_block_length":4,"reward_slots":8,"rejection_fraction":3333333333333333,"total_liquid_supply_ustx":60005711065127801,"current_cycle":{"id":21,"min_threshold_ustx":1875180000000000,"stacked_ustx":0,"is_pox_active":false},"next_cycle":{"id":22,"min_threshold_ustx":1875180000000000,"min_increment_ustx":7500713883140,"stacked_ustx":0,"prepare_phase_start_block_height":109,"blocks_until_prepare_phase":3,"reward_phase_start_block_height":110,"blocks_until_reward_phase":4,"ustx_until_pox_rejection":16879585547541744166},"min_amount_ustx":1875180000000000,"prepare_cycle_length":1,"reward_cycle_id":21,"reward_cycle_length":5,"rejection_votes_left_required":16879585547541744166,"next_reward_cycle_in":4,"contract_versions":[{"contract_id":"ST000000000000000000002AMW42H.pox","activation_burnchain_block_height":0,"first_reward_cycle_id":0},{"contract_id":"ST000000000000000000002AMW42H.pox-2","activation_burnchain_block_height":120,"first_reward_cycle_id":25}]}`,
      '/v2/data_var/ST000000000000000000002AMW42H/pox-2/configured?proof=0': `Data var not found`,
    });
    expect((await client.getPoxOperationInfo()).period).toBe(PoxOperationPeriod.Period1);

    await waitForBlock(109);
    setApiMocks({
      '/v2/pox': `{"contract_id":"ST000000000000000000002AMW42H.pox","pox_activation_threshold_ustx":600057388429055,"first_burnchain_block_height":0,"current_burnchain_block_height":109,"prepare_phase_block_length":1,"reward_phase_block_length":4,"reward_slots":8,"rejection_fraction":3333333333333333,"total_liquid_supply_ustx":60005738842905579,"current_cycle":{"id":21,"min_threshold_ustx":1875180000000000,"stacked_ustx":0,"is_pox_active":false},"next_cycle":{"id":22,"min_threshold_ustx":1875180000000000,"min_increment_ustx":7500717355363,"stacked_ustx":0,"prepare_phase_start_block_height":109,"blocks_until_prepare_phase":0,"reward_phase_start_block_height":110,"blocks_until_reward_phase":1,"ustx_until_pox_rejection":8484139029839119787},"min_amount_ustx":1875180000000000,"prepare_cycle_length":1,"reward_cycle_id":21,"reward_cycle_length":5,"rejection_votes_left_required":8484139029839119787,"next_reward_cycle_in":1,"contract_versions":[{"contract_id":"ST000000000000000000002AMW42H.pox","activation_burnchain_block_height":0,"first_reward_cycle_id":0},{"contract_id":"ST000000000000000000002AMW42H.pox-2","activation_burnchain_block_height":120,"first_reward_cycle_id":25}]}`,
      '/v2/data_var/ST000000000000000000002AMW42H/pox-2/configured?proof=0': `Data var not found`,
    });
    expect((await client.getPoxOperationInfo()).period).toBe(PoxOperationPeriod.Period1);

    await waitForBlock(110);
    setApiMocks({
      '/v2/pox': `{"contract_id":"ST000000000000000000002AMW42H.pox","pox_activation_threshold_ustx":600057388429055,"first_burnchain_block_height":0,"current_burnchain_block_height":110,"prepare_phase_block_length":1,"reward_phase_block_length":4,"reward_slots":8,"rejection_fraction":3333333333333333,"total_liquid_supply_ustx":60005738842905579,"current_cycle":{"id":21,"min_threshold_ustx":1875180000000000,"stacked_ustx":0,"is_pox_active":false},"next_cycle":{"id":22,"min_threshold_ustx":1875180000000000,"min_increment_ustx":7500717355363,"stacked_ustx":0,"prepare_phase_start_block_height":114,"blocks_until_prepare_phase":4,"reward_phase_start_block_height":115,"blocks_until_reward_phase":5,"ustx_until_pox_rejection":8484139029839119787},"min_amount_ustx":1875180000000000,"prepare_cycle_length":1,"reward_cycle_id":21,"reward_cycle_length":5,"rejection_votes_left_required":8484139029839119787,"next_reward_cycle_in":5,"contract_versions":[{"contract_id":"ST000000000000000000002AMW42H.pox","activation_burnchain_block_height":0,"first_reward_cycle_id":0},{"contract_id":"ST000000000000000000002AMW42H.pox-2","activation_burnchain_block_height":120,"first_reward_cycle_id":25}]}`,
      '/v2/data_var/ST000000000000000000002AMW42H/pox-2/configured?proof=0': `{"data":"0x03"}`,
    });
    expect((await client.getPoxOperationInfo()).period).toBe(PoxOperationPeriod.Period2a);

    await waitForBlock(111);
    setApiMocks({
      '/v2/pox': `{"contract_id":"ST000000000000000000002AMW42H.pox","pox_activation_threshold_ustx":600057388429055,"first_burnchain_block_height":0,"current_burnchain_block_height":111,"prepare_phase_block_length":1,"reward_phase_block_length":4,"reward_slots":8,"rejection_fraction":3333333333333333,"total_liquid_supply_ustx":60005738842905579,"current_cycle":{"id":22,"min_threshold_ustx":1875180000000000,"stacked_ustx":0,"is_pox_active":false},"next_cycle":{"id":23,"min_threshold_ustx":1875180000000000,"min_increment_ustx":7500717355363,"stacked_ustx":0,"prepare_phase_start_block_height":114,"blocks_until_prepare_phase":3,"reward_phase_start_block_height":115,"blocks_until_reward_phase":4,"ustx_until_pox_rejection":8484139029839119787},"min_amount_ustx":1875180000000000,"prepare_cycle_length":1,"reward_cycle_id":22,"reward_cycle_length":5,"rejection_votes_left_required":8484139029839119787,"next_reward_cycle_in":4,"contract_versions":[{"contract_id":"ST000000000000000000002AMW42H.pox","activation_burnchain_block_height":0,"first_reward_cycle_id":0},{"contract_id":"ST000000000000000000002AMW42H.pox-2","activation_burnchain_block_height":120,"first_reward_cycle_id":25}]}`,
      '/v2/data_var/ST000000000000000000002AMW42H/pox-2/configured?proof=0': `{"data":"0x03"}`,
    });
    expect((await client.getPoxOperationInfo()).period).toBe(PoxOperationPeriod.Period2a);

    await waitForBlock(119);
    setApiMocks({
      '/v2/pox': `{"contract_id":"ST000000000000000000002AMW42H.pox","pox_activation_threshold_ustx":600057388429055,"first_burnchain_block_height":0,"current_burnchain_block_height":119,"prepare_phase_block_length":1,"reward_phase_block_length":4,"reward_slots":8,"rejection_fraction":3333333333333333,"total_liquid_supply_ustx":60005738842905579,"current_cycle":{"id":23,"min_threshold_ustx":1875180000000000,"stacked_ustx":0,"is_pox_active":false},"next_cycle":{"id":24,"min_threshold_ustx":1875180000000000,"min_increment_ustx":7500717355363,"stacked_ustx":0,"prepare_phase_start_block_height":119,"blocks_until_prepare_phase":0,"reward_phase_start_block_height":120,"blocks_until_reward_phase":1,"ustx_until_pox_rejection":8484139029839119787},"min_amount_ustx":1875180000000000,"prepare_cycle_length":1,"reward_cycle_id":23,"reward_cycle_length":5,"rejection_votes_left_required":8484139029839119787,"next_reward_cycle_in":1,"contract_versions":[{"contract_id":"ST000000000000000000002AMW42H.pox","activation_burnchain_block_height":0,"first_reward_cycle_id":0},{"contract_id":"ST000000000000000000002AMW42H.pox-2","activation_burnchain_block_height":120,"first_reward_cycle_id":25}]}`,
      '/v2/data_var/ST000000000000000000002AMW42H/pox-2/configured?proof=0': `{"data":"0x03"}`,
    });
    expect((await client.getPoxOperationInfo()).period).toBe(PoxOperationPeriod.Period2a);

    await waitForBlock(120);
    setApiMocks({
      '/v2/pox': `{"contract_id":"ST000000000000000000002AMW42H.pox","pox_activation_threshold_ustx":600057388429055,"first_burnchain_block_height":0,"current_burnchain_block_height":120,"prepare_phase_block_length":1,"reward_phase_block_length":4,"reward_slots":8,"rejection_fraction":3333333333333333,"total_liquid_supply_ustx":60005738842905579,"current_cycle":{"id":23,"min_threshold_ustx":1875180000000000,"stacked_ustx":0,"is_pox_active":false},"next_cycle":{"id":24,"min_threshold_ustx":1875180000000000,"min_increment_ustx":7500717355363,"stacked_ustx":0,"prepare_phase_start_block_height":124,"blocks_until_prepare_phase":4,"reward_phase_start_block_height":125,"blocks_until_reward_phase":5,"ustx_until_pox_rejection":8484139029839119787},"min_amount_ustx":1875180000000000,"prepare_cycle_length":1,"reward_cycle_id":23,"reward_cycle_length":5,"rejection_votes_left_required":8484139029839119787,"next_reward_cycle_in":5,"contract_versions":[{"contract_id":"ST000000000000000000002AMW42H.pox","activation_burnchain_block_height":0,"first_reward_cycle_id":0},{"contract_id":"ST000000000000000000002AMW42H.pox-2","activation_burnchain_block_height":120,"first_reward_cycle_id":25}]}`,
      '/v2/data_var/ST000000000000000000002AMW42H/pox-2/configured?proof=0': `{"data":"0x03"}`,
    });
    expect((await client.getPoxOperationInfo()).period).toBe(PoxOperationPeriod.Period2a);

    await waitForBlock(121);
    setApiMocks({
      '/v2/pox': `{"contract_id":"ST000000000000000000002AMW42H.pox-2","pox_activation_threshold_ustx":600057388429055,"first_burnchain_block_height":0,"current_burnchain_block_height":121,"prepare_phase_block_length":1,"reward_phase_block_length":4,"reward_slots":8,"rejection_fraction":3333333333333333,"total_liquid_supply_ustx":60005738842905579,"current_cycle":{"id":24,"min_threshold_ustx":1875180000000000,"stacked_ustx":0,"is_pox_active":false},"next_cycle":{"id":25,"min_threshold_ustx":1875180000000000,"min_increment_ustx":7500717355363,"stacked_ustx":0,"prepare_phase_start_block_height":124,"blocks_until_prepare_phase":3,"reward_phase_start_block_height":125,"blocks_until_reward_phase":4,"ustx_until_pox_rejection":8484139029839119787},"min_amount_ustx":1875180000000000,"prepare_cycle_length":1,"reward_cycle_id":24,"reward_cycle_length":5,"rejection_votes_left_required":8484139029839119787,"next_reward_cycle_in":4,"contract_versions":[{"contract_id":"ST000000000000000000002AMW42H.pox","activation_burnchain_block_height":0,"first_reward_cycle_id":0},{"contract_id":"ST000000000000000000002AMW42H.pox-2","activation_burnchain_block_height":120,"first_reward_cycle_id":25}]}`,
      '/v2/data_var/ST000000000000000000002AMW42H/pox-2/configured?proof=0': `{"data":"0x03"}`,
    });
    expect((await client.getPoxOperationInfo()).period).toBe(PoxOperationPeriod.Period2b);

    await waitForBlock(125);
    setApiMocks({
      '/v2/pox': `{"contract_id":"ST000000000000000000002AMW42H.pox-2","pox_activation_threshold_ustx":600057388429055,"first_burnchain_block_height":0,"current_burnchain_block_height":125,"prepare_phase_block_length":1,"reward_phase_block_length":4,"reward_slots":8,"rejection_fraction":3333333333333333,"total_liquid_supply_ustx":60005738842905579,"current_cycle":{"id":24,"min_threshold_ustx":1875180000000000,"stacked_ustx":0,"is_pox_active":false},"next_cycle":{"id":25,"min_threshold_ustx":1875180000000000,"min_increment_ustx":7500717355363,"stacked_ustx":0,"prepare_phase_start_block_height":129,"blocks_until_prepare_phase":4,"reward_phase_start_block_height":130,"blocks_until_reward_phase":5,"ustx_until_pox_rejection":8484139029839119787},"min_amount_ustx":1875180000000000,"prepare_cycle_length":1,"reward_cycle_id":24,"reward_cycle_length":5,"rejection_votes_left_required":8484139029839119787,"next_reward_cycle_in":5,"contract_versions":[{"contract_id":"ST000000000000000000002AMW42H.pox","activation_burnchain_block_height":0,"first_reward_cycle_id":0},{"contract_id":"ST000000000000000000002AMW42H.pox-2","activation_burnchain_block_height":120,"first_reward_cycle_id":25}]}`,
      '/v2/data_var/ST000000000000000000002AMW42H/pox-2/configured?proof=0': `{"data":"0x03"}`,
    });
    expect((await client.getPoxOperationInfo()).period).toBe(PoxOperationPeriod.Period2b);

    await waitForBlock(126);
    setApiMocks({
      '/v2/pox': `{"contract_id":"ST000000000000000000002AMW42H.pox-2","pox_activation_threshold_ustx":600057388429055,"first_burnchain_block_height":0,"current_burnchain_block_height":126,"prepare_phase_block_length":1,"reward_phase_block_length":4,"reward_slots":8,"rejection_fraction":3333333333333333,"total_liquid_supply_ustx":60005738842905579,"current_cycle":{"id":25,"min_threshold_ustx":1875180000000000,"stacked_ustx":0,"is_pox_active":false},"next_cycle":{"id":26,"min_threshold_ustx":1875180000000000,"min_increment_ustx":7500717355363,"stacked_ustx":0,"prepare_phase_start_block_height":129,"blocks_until_prepare_phase":3,"reward_phase_start_block_height":130,"blocks_until_reward_phase":4,"ustx_until_pox_rejection":8484139029839119787},"min_amount_ustx":1875180000000000,"prepare_cycle_length":1,"reward_cycle_id":25,"reward_cycle_length":5,"rejection_votes_left_required":8484139029839119787,"next_reward_cycle_in":4,"contract_versions":[{"contract_id":"ST000000000000000000002AMW42H.pox","activation_burnchain_block_height":0,"first_reward_cycle_id":0},{"contract_id":"ST000000000000000000002AMW42H.pox-2","activation_burnchain_block_height":120,"first_reward_cycle_id":25}]}`,
      '/v2/data_var/ST000000000000000000002AMW42H/pox-2/configured?proof=0': `{"data":"0x03"}`,
    });
    expect((await client.getPoxOperationInfo()).period).toBe(PoxOperationPeriod.Period3);

    await waitForBlock(135);
    setApiMocks({
      '/v2/pox': `{"contract_id":"ST000000000000000000002AMW42H.pox-2","pox_activation_threshold_ustx":600057388429055,"first_burnchain_block_height":0,"current_burnchain_block_height":135,"prepare_phase_block_length":1,"reward_phase_block_length":4,"reward_slots":8,"rejection_fraction":3333333333333333,"total_liquid_supply_ustx":60005738842905579,"current_cycle":{"id":26,"min_threshold_ustx":1875180000000000,"stacked_ustx":0,"is_pox_active":false},"next_cycle":{"id":27,"min_threshold_ustx":1875180000000000,"min_increment_ustx":7500717355363,"stacked_ustx":0,"prepare_phase_start_block_height":139,"blocks_until_prepare_phase":4,"reward_phase_start_block_height":140,"blocks_until_reward_phase":5,"ustx_until_pox_rejection":8484139029839119787},"min_amount_ustx":1875180000000000,"prepare_cycle_length":1,"reward_cycle_id":26,"reward_cycle_length":5,"rejection_votes_left_required":8484139029839119787,"next_reward_cycle_in":5,"contract_versions":[{"contract_id":"ST000000000000000000002AMW42H.pox","activation_burnchain_block_height":0,"first_reward_cycle_id":0},{"contract_id":"ST000000000000000000002AMW42H.pox-2","activation_burnchain_block_height":120,"first_reward_cycle_id":25}]}`,
      '/v2/data_var/ST000000000000000000002AMW42H/pox-2/configured?proof=0': `{"data":"0x03"}`,
    });
    expect((await client.getPoxOperationInfo()).period).toBe(PoxOperationPeriod.Period3);
  });
});

describe('stacking transition with correct contracts', () => {
  // Prerequisites for all tests in transition `describe`:
  // * Assumming a freshly booted (or epoch 2.05) regtest around block ~100
  // * 2.1 fork at block 110 (`STACKS_21_HEIGHT=110`)
  // * PoX-2 activation at block 120 (`STACKS_POX2_HEIGHT=120`)

  // todo: unskip when api receives events from blockchain about transition unlocks
  test.skip('previously locked stx unlock automatically on period 2b', async () => {
    // See Prerequisites!
    // Step-by-step:
    // * User stacks for a long time (12 cycles, which is around ~70 blocks in regtest)
    //   * We are in `Period 1`
    //   * Users funds are stacked
    // * We wait until after the fork (block 111)
    //   * We are in `Period 2a`
    //   * Users funds are still stacked
    // * We wait until after PoX-2 activation (block 121)
    //   * We are in `Period 2b`
    //   * Users funds are no longer locked

    const privateKey = 'cb3df38053d132895220b9ce471f6b676db5b9bf0b4adefb55f2118ece2478df01';
    const address = 'STB44HYPYAT2BB2QE513NSP81HTMYWBJP02HPGK6';
    const poxAddress = '1Xik14zRm29UsyS6DjhYg4iZeZqsDa8D3';

    const network = new StacksTestnet({ url: API_URL });
    const client = new StackingClient(address, network);

    setApiMocks({
      '/v2/pox': `{"contract_id":"ST000000000000000000002AMW42H.pox","pox_activation_threshold_ustx":600057388429055,"first_burnchain_block_height":0,"current_burnchain_block_height":108,"prepare_phase_block_length":1,"reward_phase_block_length":4,"reward_slots":8,"rejection_fraction":3333333333333333,"total_liquid_supply_ustx":60005738842905579,"current_cycle":{"id":21,"min_threshold_ustx":1875180000000000,"stacked_ustx":0,"is_pox_active":false},"next_cycle":{"id":22,"min_threshold_ustx":1875180000000000,"min_increment_ustx":7500717355363,"stacked_ustx":0,"prepare_phase_start_block_height":109,"blocks_until_prepare_phase":1,"reward_phase_start_block_height":110,"blocks_until_reward_phase":2,"ustx_until_pox_rejection":8484139029839119787},"min_amount_ustx":1875180000000000,"prepare_cycle_length":1,"reward_cycle_id":21,"reward_cycle_length":5,"rejection_votes_left_required":8484139029839119787,"next_reward_cycle_in":2,"contract_versions":[{"contract_id":"ST000000000000000000002AMW42H.pox","activation_burnchain_block_height":0,"first_reward_cycle_id":0},{"contract_id":"ST000000000000000000002AMW42H.pox-2","activation_burnchain_block_height":120,"first_reward_cycle_id":25}]}`,
      '/v2/accounts/STB44HYPYAT2BB2QE513NSP81HTMYWBJP02HPGK6?proof=0': `{"balance":"0x0000000000000000002386f26fc10000","locked":"0x00000000000000000000000000000000","unlock_height":0,"nonce":0}`,
      '/v2/contracts/call-read/ST000000000000000000002AMW42H/pox/get-stacker-info': `{"okay":true,"result":"0x09"}`,
      '/v2/data_var/ST000000000000000000002AMW42H/pox-2/configured?proof=0': `Data var not found`,
      '/v2/contracts/interface/ST000000000000000000002AMW42H/pox': V2_POX_INTERFACE_POX_2,
    });
    let poxInfo = await client.getPoxInfo();
    let status = await client.getStatus();
    expect(status.stacked).toBeFalsy();

    let poxOperation = await client.getPoxOperationInfo();
    expect(poxOperation.period).toBe(PoxOperationPeriod.Period1);

    const stackingResult = await client.stack({
      amountMicroStx: BigInt(poxInfo.min_amount_ustx),
      burnBlockHeight: (poxInfo.current_burnchain_block_height as number) + 1,
      cycles: 12,
      poxAddress,
      privateKey,
    });
    await waitForTx(stackingResult.txid);

    setApiMocks({
      '/v2/pox': `{"contract_id":"ST000000000000000000002AMW42H.pox","pox_activation_threshold_ustx":600057388429055,"first_burnchain_block_height":0,"current_burnchain_block_height":109,"prepare_phase_block_length":1,"reward_phase_block_length":4,"reward_slots":8,"rejection_fraction":3333333333333333,"total_liquid_supply_ustx":60005738842905579,"current_cycle":{"id":21,"min_threshold_ustx":1875180000000000,"stacked_ustx":0,"is_pox_active":false},"next_cycle":{"id":22,"min_threshold_ustx":1875180000000000,"min_increment_ustx":7500717355363,"stacked_ustx":1875180000000000,"prepare_phase_start_block_height":109,"blocks_until_prepare_phase":0,"reward_phase_start_block_height":110,"blocks_until_reward_phase":1,"ustx_until_pox_rejection":8484139029839119787},"min_amount_ustx":1875180000000000,"prepare_cycle_length":1,"reward_cycle_id":21,"reward_cycle_length":5,"rejection_votes_left_required":8484139029839119787,"next_reward_cycle_in":1,"contract_versions":[{"contract_id":"ST000000000000000000002AMW42H.pox","activation_burnchain_block_height":0,"first_reward_cycle_id":0},{"contract_id":"ST000000000000000000002AMW42H.pox-2","activation_burnchain_block_height":120,"first_reward_cycle_id":25}]}`,
      '/v2/accounts/STB44HYPYAT2BB2QE513NSP81HTMYWBJP02HPGK6?proof=0': `{"balance":"0x0000000000000000001cdd7b11f6a0f0","locked":"0x00000000000000000006a9775dca3800","unlock_height":170,"nonce":1}`,
      '/v2/contracts/call-read/ST000000000000000000002AMW42H/pox/get-stacker-info': `{"okay":true,"result":"0x0a0c000000040b616d6f756e742d757374780100000000000000000006a9775dca38001266697273742d7265776172642d6379636c6501000000000000000000000000000000160b6c6f636b2d706572696f64010000000000000000000000000000000c08706f782d616464720c0000000209686173686279746573020000001405cf52a44bf3e6829b4f8c221cc675355bf83b7d0776657273696f6e020000000100"}`,
    });
    status = await client.getStatus();
    if (!status.stacked) throw Error;
    const initialUnlockHeight = status.details.unlock_height;

    await waitForBlock(111, client);

    setApiMocks({
      '/v2/pox': `{"contract_id":"ST000000000000000000002AMW42H.pox","pox_activation_threshold_ustx":600057388429055,"first_burnchain_block_height":0,"current_burnchain_block_height":111,"prepare_phase_block_length":1,"reward_phase_block_length":4,"reward_slots":8,"rejection_fraction":3333333333333333,"total_liquid_supply_ustx":60005738842905579,"current_cycle":{"id":21,"min_threshold_ustx":1875180000000000,"stacked_ustx":0,"is_pox_active":false},"next_cycle":{"id":22,"min_threshold_ustx":1875180000000000,"min_increment_ustx":7500717355363,"stacked_ustx":1875180000000000,"prepare_phase_start_block_height":114,"blocks_until_prepare_phase":3,"reward_phase_start_block_height":115,"blocks_until_reward_phase":4,"ustx_until_pox_rejection":8484139029839119787},"min_amount_ustx":1875180000000000,"prepare_cycle_length":1,"reward_cycle_id":21,"reward_cycle_length":5,"rejection_votes_left_required":8484139029839119787,"next_reward_cycle_in":4,"contract_versions":[{"contract_id":"ST000000000000000000002AMW42H.pox","activation_burnchain_block_height":0,"first_reward_cycle_id":0},{"contract_id":"ST000000000000000000002AMW42H.pox-2","activation_burnchain_block_height":120,"first_reward_cycle_id":25}]}`,
      '/v2/data_var/ST000000000000000000002AMW42H/pox-2/configured?proof=0': `{"data":"0x03"}`,
    });
    poxOperation = await client.getPoxOperationInfo();
    expect(poxOperation.period).toBe(PoxOperationPeriod.Period2a);

    await waitForBlock(121, client);

    setApiMocks({
      '/v2/pox': `{"contract_id":"ST000000000000000000002AMW42H.pox-2","pox_activation_threshold_ustx":600057388429055,"first_burnchain_block_height":0,"current_burnchain_block_height":121,"prepare_phase_block_length":1,"reward_phase_block_length":4,"reward_slots":8,"rejection_fraction":3333333333333333,"total_liquid_supply_ustx":60005738842905579,"current_cycle":{"id":24,"min_threshold_ustx":1875180000000000,"stacked_ustx":0,"is_pox_active":false},"next_cycle":{"id":25,"min_threshold_ustx":1875180000000000,"min_increment_ustx":7500717355363,"stacked_ustx":0,"prepare_phase_start_block_height":124,"blocks_until_prepare_phase":3,"reward_phase_start_block_height":125,"blocks_until_reward_phase":4,"ustx_until_pox_rejection":8484139029839119787},"min_amount_ustx":1875180000000000,"prepare_cycle_length":1,"reward_cycle_id":24,"reward_cycle_length":5,"rejection_votes_left_required":8484139029839119787,"next_reward_cycle_in":4,"contract_versions":[{"contract_id":"ST000000000000000000002AMW42H.pox","activation_burnchain_block_height":0,"first_reward_cycle_id":0},{"contract_id":"ST000000000000000000002AMW42H.pox-2","activation_burnchain_block_height":120,"first_reward_cycle_id":25}]}`,
      '/v2/data_var/ST000000000000000000002AMW42H/pox-2/configured?proof=0': `{"data":"0x03"}`,
      '/v2/accounts/STB44HYPYAT2BB2QE513NSP81HTMYWBJP02HPGK6?proof=0': `{"balance":"0x0000000000000000002386f26fc0d8f0","locked":"0x00000000000000000000000000000000","unlock_height":0,"nonce":1}`,
      '/v2/contracts/call-read/ST000000000000000000002AMW42H/pox-2/get-stacker-info': `{"okay":true,"result":"0x09"}`,
      // todo: replace with working data once api receives events (this test will fail for now)
      '/extended/v1/address/STB44HYPYAT2BB2QE513NSP81HTMYWBJP02HPGK6/balances': `{"stx": {"balance": "-10000","total_sent": "0","total_received": "0","total_fees_sent": "10000","total_miner_rewards_received": "0","lock_tx_id": "0xfd191616adc625d9b26e5331d46cee009cfb12acd4f86e338a195920ccb6e152","locked": "1875180000000000","lock_height": 4,"burnchain_lock_height": 107,"burnchain_unlock_height": 170 },"fungible_tokens": {},"non_fungible_tokens":}`,
    });
    poxInfo = await client.getPoxInfo();
    expect(poxInfo.current_burnchain_block_height).toBeLessThan(initialUnlockHeight);
    poxOperation = await client.getPoxOperationInfo();
    expect(poxOperation.period).toBe(PoxOperationPeriod.Period2b);
    status = await client.getStatus();
    expect(status.stacked).toBeFalsy();
    const balanceLocked = await client.getAccountBalanceLocked();
    expect(balanceLocked).toBe(0n);

    // todo: replace with working data once api receives events (this test will fail for now)
    const extendedAccountInfo = await client.getAccountExtendedBalances();
    expect(extendedAccountInfo.stx.locked).toBe(0);
  });

  test('in period 1, pox-1 stacking into period 3 works', async () => {
    // See Prerequisites!
    // Step-by-step:
    // * Stack for long enough to overlap with Period 3

    const privateKey = 'cb3df38053d132895220b9ce471f6b676db5b9bf0b4adefb55f2118ece2478df01';
    const address = 'STB44HYPYAT2BB2QE513NSP81HTMYWBJP02HPGK6';
    const poxAddress = '1Xik14zRm29UsyS6DjhYg4iZeZqsDa8D3';

    const network = new StacksTestnet({ url: API_URL });
    const client = new StackingClient(address, network);

    setApiMocks({
      '/v2/pox': `{"contract_id":"ST000000000000000000002AMW42H.pox","pox_activation_threshold_ustx":600057388429055,"first_burnchain_block_height":0,"current_burnchain_block_height":107,"prepare_phase_block_length":1,"reward_phase_block_length":4,"reward_slots":8,"rejection_fraction":3333333333333333,"total_liquid_supply_ustx":60005738842905579,"current_cycle":{"id":21,"min_threshold_ustx":1875180000000000,"stacked_ustx":0,"is_pox_active":false},"next_cycle":{"id":22,"min_threshold_ustx":1875180000000000,"min_increment_ustx":7500717355363,"stacked_ustx":0,"prepare_phase_start_block_height":109,"blocks_until_prepare_phase":2,"reward_phase_start_block_height":110,"blocks_until_reward_phase":3,"ustx_until_pox_rejection":8484139029839119787},"min_amount_ustx":1875180000000000,"prepare_cycle_length":1,"reward_cycle_id":21,"reward_cycle_length":5,"rejection_votes_left_required":8484139029839119787,"next_reward_cycle_in":3,"contract_versions":[{"contract_id":"ST000000000000000000002AMW42H.pox","activation_burnchain_block_height":0,"first_reward_cycle_id":0},{"contract_id":"ST000000000000000000002AMW42H.pox-2","activation_burnchain_block_height":120,"first_reward_cycle_id":25}]}`,
      '/v2/data_var/ST000000000000000000002AMW42H/pox-2/configured?proof=0': `Data var not found`,
      '/v2/accounts/STB44HYPYAT2BB2QE513NSP81HTMYWBJP02HPGK6?proof=0': `{"balance":"0x0000000000000000001cdd7b11f6a0f0","locked":"0x00000000000000000006a9775dca3800","unlock_height":170,"nonce":1}`,
      '/v2/contracts/interface/ST000000000000000000002AMW42H/pox': V2_POX_INTERFACE_POX_2,
    });

    const poxOperation = await client.getPoxOperationInfo();
    expect(poxOperation.period).toBe(PoxOperationPeriod.Period1);

    const poxInfo = await client.getPoxInfo();

    const stackingResult = await client.stack({
      amountMicroStx: poxInfo.min_amount_ustx,
      burnBlockHeight: poxInfo.current_burnchain_block_height as number,
      cycles: 12,
      poxAddress,
      privateKey,
    });

    await waitForTx(stackingResult.txid);

    const balanceLocked = await client.getAccountBalanceLocked();
    expect(balanceLocked).toBe(BigInt(poxInfo.min_amount_ustx));

    const lastBroadcast = getFetchMockBroadcast();
    expect(
      (deserializeTransaction(lastBroadcast.body as Uint8Array).payload as ContractCallPayload)
        .contractName.content
    ).toBe('pox');
  });

  test('in period 2a, pox-2 stacking into period 3 works', async () => {
    // See Prerequisites!
    // Step-by-step:
    // * Wait for Period 2a
    // * Stack for a long time

    const privateKey = 'cb3df38053d132895220b9ce471f6b676db5b9bf0b4adefb55f2118ece2478df01';
    const address = 'STB44HYPYAT2BB2QE513NSP81HTMYWBJP02HPGK6';
    const poxAddress = '1Xik14zRm29UsyS6DjhYg4iZeZqsDa8D3';

    const network = new StacksTestnet({ url: API_URL });
    const client = new StackingClient(address, network);

    await waitForBlock(111);

    setApiMocks({
      '/v2/pox': `{"contract_id":"ST000000000000000000002AMW42H.pox","pox_activation_threshold_ustx":600057388429055,"first_burnchain_block_height":0,"current_burnchain_block_height":111,"prepare_phase_block_length":1,"reward_phase_block_length":4,"reward_slots":8,"rejection_fraction":3333333333333333,"total_liquid_supply_ustx":60005738842905579,"current_cycle":{"id":22,"min_threshold_ustx":1875180000000000,"stacked_ustx":0,"is_pox_active":false},"next_cycle":{"id":23,"min_threshold_ustx":1875180000000000,"min_increment_ustx":7500717355363,"stacked_ustx":0,"prepare_phase_start_block_height":114,"blocks_until_prepare_phase":3,"reward_phase_start_block_height":115,"blocks_until_reward_phase":4,"ustx_until_pox_rejection":8484139029839119787},"min_amount_ustx":1875180000000000,"prepare_cycle_length":1,"reward_cycle_id":22,"reward_cycle_length":5,"rejection_votes_left_required":8484139029839119787,"next_reward_cycle_in":4,"contract_versions":[{"contract_id":"ST000000000000000000002AMW42H.pox","activation_burnchain_block_height":0,"first_reward_cycle_id":0},{"contract_id":"ST000000000000000000002AMW42H.pox-2","activation_burnchain_block_height":120,"first_reward_cycle_id":25}]}`,
      '/v2/data_var/ST000000000000000000002AMW42H/pox-2/configured?proof=0': `{"data":"0x03"}`,
      '/v2/accounts/STB44HYPYAT2BB2QE513NSP81HTMYWBJP02HPGK6?proof=0': `{"balance":"0x0000000000000000002386f26fc10000","locked":"0x00000000000000000000000000000000","unlock_height":0,"nonce":0}`,
      '/v2/contracts/interface/ST000000000000000000002AMW42H/pox-2': V2_POX_INTERFACE_POX_2,
    });

    const poxOperation = await client.getPoxOperationInfo();
    expect(poxOperation.period).toBe(PoxOperationPeriod.Period2a);

    const poxInfo = await client.getPoxInfo();

    const stackingResult = await client.stack({
      amountMicroStx: poxInfo.min_amount_ustx,
      burnBlockHeight: poxInfo.current_burnchain_block_height as number,
      cycles: 12,
      poxAddress,
      privateKey,
    });

    await waitForTx(stackingResult.txid);

    setApiMocks({
      '/v2/accounts/STB44HYPYAT2BB2QE513NSP81HTMYWBJP02HPGK6?proof=0': `{"balance":"0x0000000000000000001cdd7b11f6a0f0","locked":"0x00000000000000000006a9775dca3800","unlock_height":175,"nonce":1}`,
    });

    const balanceLocked = await client.getAccountBalanceLocked();
    expect(balanceLocked).toBe(BigInt(poxInfo.min_amount_ustx));

    const lastBroadcast = getFetchMockBroadcast();
    expect(
      (deserializeTransaction(lastBroadcast.body as Uint8Array).payload as ContractCallPayload)
        .contractName.content
    ).toBe('pox-2');
  });

  test('in period 2b, pox-2 stacking into period 3 works', async () => {
    // See Prerequisites!
    // Step-by-step:
    // * Wait for Period 2b
    // * Stack for a long time

    const privateKey = 'cb3df38053d132895220b9ce471f6b676db5b9bf0b4adefb55f2118ece2478df01';
    const address = 'STB44HYPYAT2BB2QE513NSP81HTMYWBJP02HPGK6';
    const poxAddress = '1Xik14zRm29UsyS6DjhYg4iZeZqsDa8D3';

    const network = new StacksTestnet({ url: API_URL });
    const client = new StackingClient(address, network);

    await waitForBlock(121);

    setApiMocks({
      '/v2/pox': `{"contract_id":"ST000000000000000000002AMW42H.pox-2","pox_activation_threshold_ustx":600057388429055,"first_burnchain_block_height":0,"current_burnchain_block_height":121,"prepare_phase_block_length":1,"reward_phase_block_length":4,"reward_slots":8,"rejection_fraction":3333333333333333,"total_liquid_supply_ustx":60005738842905579,"current_cycle":{"id":24,"min_threshold_ustx":1875180000000000,"stacked_ustx":0,"is_pox_active":false},"next_cycle":{"id":25,"min_threshold_ustx":1875180000000000,"min_increment_ustx":7500717355363,"stacked_ustx":0,"prepare_phase_start_block_height":124,"blocks_until_prepare_phase":3,"reward_phase_start_block_height":125,"blocks_until_reward_phase":4,"ustx_until_pox_rejection":8484139029839119787},"min_amount_ustx":1875180000000000,"prepare_cycle_length":1,"reward_cycle_id":24,"reward_cycle_length":5,"rejection_votes_left_required":8484139029839119787,"next_reward_cycle_in":4,"contract_versions":[{"contract_id":"ST000000000000000000002AMW42H.pox","activation_burnchain_block_height":0,"first_reward_cycle_id":0},{"contract_id":"ST000000000000000000002AMW42H.pox-2","activation_burnchain_block_height":120,"first_reward_cycle_id":25}]}`,
      '/v2/data_var/ST000000000000000000002AMW42H/pox-2/configured?proof=0': `{"data":"0x03"}`,
      '/v2/accounts/STB44HYPYAT2BB2QE513NSP81HTMYWBJP02HPGK6?proof=0': `{"balance":"0x0000000000000000002386f26fc10000","locked":"0x00000000000000000000000000000000","unlock_height":0,"nonce":0}`,
      '/v2/contracts/interface/ST000000000000000000002AMW42H/pox-2': V2_POX_INTERFACE_POX_2,
    });

    const poxOperation = await client.getPoxOperationInfo();
    expect(poxOperation.period).toBe(PoxOperationPeriod.Period2b);

    const poxInfo = await client.getPoxInfo();

    const stackingResult = await client.stack({
      amountMicroStx: poxInfo.min_amount_ustx,
      burnBlockHeight: poxInfo.current_burnchain_block_height as number,
      cycles: 12,
      poxAddress,
      privateKey,
    });

    await waitForTx(stackingResult.txid);

    setApiMocks({
      '/v2/accounts/STB44HYPYAT2BB2QE513NSP81HTMYWBJP02HPGK6?proof=0': `{"balance":"0x0000000000000000001cdd7b11f6a0f0","locked":"0x00000000000000000006a9775dca3800","unlock_height":185,"nonce":1}`,
    });

    const balanceLocked = await client.getAccountBalanceLocked();
    expect(balanceLocked).toBe(BigInt(poxInfo.min_amount_ustx));

    const lastBroadcast = getFetchMockBroadcast();
    expect(
      (deserializeTransaction(lastBroadcast.body as Uint8Array).payload as ContractCallPayload)
        .contractName.content
    ).toBe('pox-2');
  });

  test('in period 3, pox-2 stacking works', async () => {
    // See Prerequisites!
    // Step-by-step:
    // * Wait for Period 3
    // * Stack for a long time

    const privateKey = 'cb3df38053d132895220b9ce471f6b676db5b9bf0b4adefb55f2118ece2478df01';
    const address = 'STB44HYPYAT2BB2QE513NSP81HTMYWBJP02HPGK6';
    const poxAddress = '1Xik14zRm29UsyS6DjhYg4iZeZqsDa8D3';

    const network = new StacksTestnet({ url: API_URL });
    const client = new StackingClient(address, network);

    await waitForBlock(126);

    setApiMocks({
      '/v2/pox': `{"contract_id":"ST000000000000000000002AMW42H.pox-2","pox_activation_threshold_ustx":600057388429055,"first_burnchain_block_height":0,"current_burnchain_block_height":126,"prepare_phase_block_length":1,"reward_phase_block_length":4,"reward_slots":8,"rejection_fraction":3333333333333333,"total_liquid_supply_ustx":60005738842905579,"current_cycle":{"id":25,"min_threshold_ustx":1875180000000000,"stacked_ustx":0,"is_pox_active":false},"next_cycle":{"id":26,"min_threshold_ustx":1875180000000000,"min_increment_ustx":7500717355363,"stacked_ustx":0,"prepare_phase_start_block_height":129,"blocks_until_prepare_phase":3,"reward_phase_start_block_height":130,"blocks_until_reward_phase":4,"ustx_until_pox_rejection":8484139029839119787},"min_amount_ustx":1875180000000000,"prepare_cycle_length":1,"reward_cycle_id":25,"reward_cycle_length":5,"rejection_votes_left_required":8484139029839119787,"next_reward_cycle_in":4,"contract_versions":[{"contract_id":"ST000000000000000000002AMW42H.pox","activation_burnchain_block_height":0,"first_reward_cycle_id":0},{"contract_id":"ST000000000000000000002AMW42H.pox-2","activation_burnchain_block_height":120,"first_reward_cycle_id":25}]}`,
      '/v2/data_var/ST000000000000000000002AMW42H/pox-2/configured?proof=0': `{"data":"0x03"}`,
      '/v2/accounts/STB44HYPYAT2BB2QE513NSP81HTMYWBJP02HPGK6?proof=0': `{"balance":"0x0000000000000000002386f26fc10000","locked":"0x00000000000000000000000000000000","unlock_height":0,"nonce":0}`,
      '/v2/contracts/interface/ST000000000000000000002AMW42H/pox-2': V2_POX_INTERFACE_POX_2,
    });

    const poxOperation = await client.getPoxOperationInfo();
    expect(poxOperation.period).toBe(PoxOperationPeriod.Period3);

    const poxInfo = await client.getPoxInfo();

    const stackingResult = await client.stack({
      amountMicroStx: poxInfo.min_amount_ustx,
      burnBlockHeight: poxInfo.current_burnchain_block_height as number,
      cycles: 12,
      poxAddress,
      privateKey,
    });

    await waitForTx(stackingResult.txid);

    setApiMocks({
      '/v2/accounts/STB44HYPYAT2BB2QE513NSP81HTMYWBJP02HPGK6?proof=0': `{"balance":"0x0000000000000000001cdd7b11f6a0f0","locked":"0x00000000000000000006a9775dca3800","unlock_height":190,"nonce":1}`,
    });

    const balanceLocked = await client.getAccountBalanceLocked();
    expect(balanceLocked).toBe(BigInt(poxInfo.min_amount_ustx));

    const lastBroadcast = getFetchMockBroadcast();
    expect(
      (deserializeTransaction(lastBroadcast.body as Uint8Array).payload as ContractCallPayload)
        .contractName.content
    ).toBe('pox-2');
  });
});

describe('stacking eligibility', () => {
  test('eligible', async () => {
    setApiMocks(MOCK_FULL_ACCOUNT);

    const address = 'STB44HYPYAT2BB2QE513NSP81HTMYWBJP02HPGK6';
    const poxAddress = '1Xik14zRm29UsyS6DjhYg4iZeZqsDa8D3';

    const network = new StacksTestnet({ url: API_URL });

    const client = new StackingClient(address, network);

    const cycles = 1;
    const stackingEligibility = await client.canStack({ poxAddress, cycles });

    expect(fetchMock.mock.calls.length).toEqual(3);
    expect(fetchMock.mock.calls[0][0]).toEqual(network.getAccountApiUrl(address));
    expect(fetchMock.mock.calls[1][0]).toEqual(network.getPoxInfoUrl());
    expect(fetchMock.mock.calls[2][0]).toContain('/pox-2/can-stack-stx');
    expect(stackingEligibility.eligible).toBe(true);
  });

  test('not eligible', async () => {
    setApiMocks(MOCK_EMPTY_ACCOUNT);

    const address = 'ST162GBCTD9ESBF09XC2T63NCX6ZKS42ZPWGXZ6VH';
    const poxAddress = 'mnTdnFyjxRomWaSLp4fNGSa9Gyg9XJo4j4';

    const network = new StacksTestnet({ url: API_URL });
    const client = new StackingClient(address, network);

    const cycles = 1;
    const stackingEligibility = await client.canStack({ poxAddress, cycles });

    expect(fetchMock.mock.calls.length).toEqual(3);
    expect(fetchMock.mock.calls[0][0]).toEqual(network.getAccountApiUrl(address));
    expect(fetchMock.mock.calls[1][0]).toEqual(network.getPoxInfoUrl());
    expect(fetchMock.mock.calls[2][0]).toContain('/pox-2/can-stack-stx');
    expect(stackingEligibility.eligible).toBe(false);
    expect(stackingEligibility.reason).toBe('ERR_STACKING_THRESHOLD_NOT_MET');
  });
});

describe('normal stacking', () => {
  test('stack stx', async () => {
    const privateKey = 'cb3df38053d132895220b9ce471f6b676db5b9bf0b4adefb55f2118ece2478df01';
    const address = 'STB44HYPYAT2BB2QE513NSP81HTMYWBJP02HPGK6';
    const poxAddress = '1Xik14zRm29UsyS6DjhYg4iZeZqsDa8D3';

    const network = new StacksTestnet({ url: API_URL });
    const client = new StackingClient(address, network);

    setApiMocks({
      ...MOCK_POX_2_REGTEST,
      '/v2/accounts/STB44HYPYAT2BB2QE513NSP81HTMYWBJP02HPGK6?proof=0': `{"balance":"0x0000000000000000002386f26fbe67f0","locked":"0x00000000000000000000000000000000","unlock_height":0,"nonce":17}`,
      '/v2/contracts/call-read/ST000000000000000000002AMW42H/pox-2/get-stacker-info': `{"okay":true,"result":"0x09"}`,
    });

    const poxInfo = await client.getPoxInfo();
    let status = await client.getStatus();
    expect(status.stacked).toBeFalsy();

    const stackingResult = await client.stack({
      amountMicroStx: BigInt(poxInfo.min_amount_ustx),
      burnBlockHeight: (poxInfo.current_burnchain_block_height as number) + 1,
      cycles: 2,
      poxAddress,
      privateKey,
    });
    await waitForTx(stackingResult.txid);

    setApiMocks({
      ...MOCK_POX_2_REGTEST,
      '/v2/accounts/STB44HYPYAT2BB2QE513NSP81HTMYWBJP02HPGK6?proof=0': `{"balance":"0x0000000000000000001cdd687194e8e0","locked":"0x00000000000000000006a989fe295800","unlock_height":2675,"nonce":18}`,
      '/v2/contracts/call-read/ST000000000000000000002AMW42H/pox-2/get-stacker-info': `{"okay":true,"result":"0x0a0c000000041266697273742d7265776172642d6379636c6501000000000000000000000000000002150b6c6f636b2d706572696f64010000000000000000000000000000000208706f782d616464720c0000000209686173686279746573020000001405cf52a44bf3e6829b4f8c221cc675355bf83b7d0776657273696f6e020000000100127265776172642d7365742d696e64657865730b0000000201000000000000000000000000000000000100000000000000000000000000000000"}`,
    });

    status = await client.getStatus();
    expect(status.stacked).toBeTruthy();
  });

  test('stack and extend stx', async () => {
    const privateKey = 'cb3df38053d132895220b9ce471f6b676db5b9bf0b4adefb55f2118ece2478df01';
    const address = 'STB44HYPYAT2BB2QE513NSP81HTMYWBJP02HPGK6';
    const poxAddress = '1Xik14zRm29UsyS6DjhYg4iZeZqsDa8D3';

    const network = new StacksTestnet({ url: API_URL });
    const client = new StackingClient(address, network);

    setApiMocks({
      ...MOCK_POX_2_REGTEST,
      '/v2/accounts/STB44HYPYAT2BB2QE513NSP81HTMYWBJP02HPGK6?proof=0': `{"balance":"0x0000000000000000002386f26fc0b1e0","locked":"0x00000000000000000000000000000000","unlock_height":0,"nonce":2}`,
    });
    const poxInfo = await client.getPoxInfo();

    const BEGIN_LOCK_HEIGHT = (poxInfo.current_burnchain_block_height as number) + 2;
    const stackingResult = await client.stack({
      amountMicroStx: BigInt(poxInfo.min_amount_ustx),
      burnBlockHeight: BEGIN_LOCK_HEIGHT,
      cycles: 2,
      poxAddress,
      privateKey,
    });
    await waitForTx(stackingResult.txid);
    await waitForBlock(BEGIN_LOCK_HEIGHT + 1, client);

    setApiMocks({
      ...MOCK_POX_2_REGTEST,
      '/v2/accounts/STB44HYPYAT2BB2QE513NSP81HTMYWBJP02HPGK6?proof=0': `{"balance":"0x0000000000000000001cdd7b11f652d0","locked":"0x00000000000000000006a9775dca3800","unlock_height":175,"nonce":3}`,
      '/v2/contracts/call-read/ST000000000000000000002AMW42H/pox-2/get-stacker-info': `{"okay":true,"result":"0x0a0c000000041266697273742d7265776172642d6379636c6501000000000000000000000000000000210b6c6f636b2d706572696f64010000000000000000000000000000000208706f782d616464720c0000000209686173686279746573020000001405cf52a44bf3e6829b4f8c221cc675355bf83b7d0776657273696f6e020000000100127265776172642d7365742d696e64657865730b0000000201000000000000000000000000000000000100000000000000000000000000000000"}`,
    });
    const initialStatus = await client.getStatus();
    if (!initialStatus.stacked) throw Error;

    const EXTEND_BY = 2;
    const extendResult = await client.stackExtend({
      extendCycles: EXTEND_BY,
      poxAddress,
      privateKey,
    });
    await waitForTx(extendResult.txid);

    setApiMocks({
      ...MOCK_POX_2_REGTEST,
      '/v2/accounts/STB44HYPYAT2BB2QE513NSP81HTMYWBJP02HPGK6?proof=0': `{"balance":"0x0000000000000000001cdd7b11f62bc0","locked":"0x00000000000000000006a9775dca3800","unlock_height":185,"nonce":4}`,
      '/v2/contracts/call-read/ST000000000000000000002AMW42H/pox-2/get-stacker-info': `{"okay":true,"result":"0x0a0c000000041266697273742d7265776172642d6379636c6501000000000000000000000000000000210b6c6f636b2d706572696f64010000000000000000000000000000000408706f782d616464720c0000000209686173686279746573020000001405cf52a44bf3e6829b4f8c221cc675355bf83b7d0776657273696f6e020000000100127265776172642d7365742d696e64657865730b000000040100000000000000000000000000000000010000000000000000000000000000000001000000000000000000000000000000000100000000000000000000000000000000"}`,
    });
    const finalStatus = await client.getStatus();
    if (!finalStatus.stacked) throw Error;

    const expectedHeight =
      initialStatus?.details.unlock_height +
      EXTEND_BY * (poxInfo.prepare_phase_block_length + poxInfo.reward_phase_block_length);
    expect(finalStatus?.details.unlock_height).toBe(expectedHeight);
  });

  test('stack and increase stx', async () => {
    const privateKey = 'cb3df38053d132895220b9ce471f6b676db5b9bf0b4adefb55f2118ece2478df01';
    const address = 'STB44HYPYAT2BB2QE513NSP81HTMYWBJP02HPGK6';
    const poxAddress = '1Xik14zRm29UsyS6DjhYg4iZeZqsDa8D3';

    const network = new StacksTestnet({ url: API_URL });
    const client = new StackingClient(address, network);

    setApiMocks({
      ...MOCK_POX_2_REGTEST,
      '/v2/accounts/STB44HYPYAT2BB2QE513NSP81HTMYWBJP02HPGK6?proof=0': `{"balance":"0x0000000000000000002386f26fc063c0","locked":"0x00000000000000000000000000000000","unlock_height":0,"nonce":4}`,
    });
    const poxInfo = await client.getPoxInfo();

    const BEGIN_LOCK_HEIGHT = (poxInfo.current_burnchain_block_height as number) + 2;
    const INITIAL_AMOUNT = BigInt(poxInfo.min_amount_ustx);
    const stackingResult = await client.stack({
      amountMicroStx: INITIAL_AMOUNT,
      burnBlockHeight: BEGIN_LOCK_HEIGHT,
      cycles: 10,
      poxAddress,
      privateKey,
    });
    await waitForTx(stackingResult.txid);
    await waitForBlock(BEGIN_LOCK_HEIGHT + 3, client);

    setApiMocks({
      ...MOCK_POX_2_REGTEST,
      '/v2/accounts/STB44HYPYAT2BB2QE513NSP81HTMYWBJP02HPGK6?proof=0': `{"balance":"0x0000000000000000001cdd71c1c674b0","locked":"0x00000000000000000006a980adf9c800","unlock_height":1465,"nonce":5}`,
    });
    const initialBalanceLocked = await client.getAccountBalanceLocked();
    if (initialBalanceLocked === 0n) throw Error;

    const INCREASE_BY = 40_000_000n;
    const increaseResult = await client.stackIncrease({
      increaseBy: INCREASE_BY,
      privateKey,
    });
    await waitForTx(increaseResult.txid);

    setApiMocks({
      '/v2/accounts/STB44HYPYAT2BB2QE513NSP81HTMYWBJP02HPGK6?proof=0': `{"balance":"0x0000000000000000001cdd71bf63f3a0","locked":"0x00000000000000000006a980b05c2200","unlock_height":1465,"nonce":6}`,
    });
    const finalBalanceLocked = await client.getAccountBalanceLocked();
    if (finalBalanceLocked === 0n) throw Error;

    const expectedBalanceLocked = initialBalanceLocked + INCREASE_BY;
    expect(finalBalanceLocked).toBe(expectedBalanceLocked);
  });
});

describe('delegated stacking', () => {
  test('delegate stx', async () => {
    const privateKey = 'cb3df38053d132895220b9ce471f6b676db5b9bf0b4adefb55f2118ece2478df01';
    const address = 'STB44HYPYAT2BB2QE513NSP81HTMYWBJP02HPGK6';
    const poxAddress = '1Xik14zRm29UsyS6DjhYg4iZeZqsDa8D3';

    const delegateTo = 'ST2MCYPWTFMD2MGR5YY695EJG0G1R4J2BTJPRGM7H';

    const network = new StacksTestnet({ url: API_URL });
    const client = new StackingClient(address, network);

    setApiMocks({
      ...MOCK_POX_2_REGTEST,
      '/v2/contracts/call-read/ST000000000000000000002AMW42H/pox-2/get-delegation-info': `{"okay":true,"result":"0x09"}`,
      '/v2/accounts/STB44HYPYAT2BB2QE513NSP81HTMYWBJP02HPGK6?proof=0': `{"balance":"0x0000000000000000002386f26fbdf2c0","locked":"0x00000000000000000000000000000000","unlock_height":0,"nonce":20}`,
    });

    let status = await client.getDelegationStatus();
    expect(status.delegated).toBeFalsy();

    const poxInfo = await client.getPoxInfo();
    const delegationResult = await client.delegateStx({
      delegateTo,
      amountMicroStx: BigInt(poxInfo.min_amount_ustx),
      untilBurnBlockHeight: (poxInfo.current_burnchain_block_height as number) + 5,
      poxAddress,
      privateKey,
    });
    await waitForTx(delegationResult.txid);

    setApiMocks({
      ...MOCK_POX_2_REGTEST,
      '/v2/contracts/call-read/ST000000000000000000002AMW42H/pox-2/get-delegation-info': `{"okay":true,"result":"0x0a0c000000040b616d6f756e742d757374780100000000000000000006a9b192f37c000c64656c6567617465642d746f051aa8cf5b9a7d1a2a4305f78c92ba50040382484bd408706f782d616464720a0c0000000209686173686279746573020000001405cf52a44bf3e6829b4f8c221cc675355bf83b7d0776657273696f6e0200000001000d756e74696c2d6275726e2d68740a0100000000000000000000000000001eb4"}`,
    });

    status = await client.getDelegationStatus();
    expect(status.delegated).toBeTruthy();
  });

  test('delegate stack, and delegator stack', async () => {
    const privateKey = 'cb3df38053d132895220b9ce471f6b676db5b9bf0b4adefb55f2118ece2478df01';
    const address = 'STB44HYPYAT2BB2QE513NSP81HTMYWBJP02HPGK6';

    const delegatorPrivateKey =
      '21d43d2ae0da1d9d04cfcaac7d397a33733881081f0b2cd038062cf0ccbb752601';
    const delegatorAddress = 'ST11NJTTKGVT6D1HY4NJRVQWMQM7TVAR091EJ8P2Y';
    const delegatorPoxAddress = '1797Pp1o8A7a8X8Qs7ejXtYyw8gbecFK2b';

    const network = new StacksTestnet({ url: API_URL });
    const client = new StackingClient(address, network);
    const delegatorClient = new StackingClient(delegatorAddress, network);

    setApiMocks({
      ...MOCK_POX_2_REGTEST,
      '/v2/accounts/STB44HYPYAT2BB2QE513NSP81HTMYWBJP02HPGK6?proof=0': `{"balance":"0x0000000000000000002386f26fbdcbb0","locked":"0x00000000000000000000000000000000","unlock_height":0,"nonce":21}`,
      '/v2/accounts/ST11NJTTKGVT6D1HY4NJRVQWMQM7TVAR091EJ8P2Y?proof=0': `{"balance":"0x0000000000000000002386f26fc08ad0","locked":"0x00000000000000000000000000000000","unlock_height":0,"nonce":3}`,
      '/v2/contracts/call-read/ST000000000000000000002AMW42H/pox-2/get-delegation-info': `{"okay":true,"result":"0x0a0c000000040b616d6f756e742d75737478010000000000000000000354d8c979be000c64656c6567617465642d746f051a43596b5386f466863e25658ddf94bd0fadab004808706f782d616464720a0c0000000209686173686279746573020000001443596b5386f466863e25658ddf94bd0fadab00480776657273696f6e0200000001000d756e74696c2d6275726e2d68740a0100000000000000000000000000001f14"}`,
      '/v2/contracts/call-read/ST000000000000000000002AMW42H/pox-2/get-stacker-info': `{"okay":true,"result":"0x09"}`,
    });

    let poxInfo = await client.getPoxInfo();
    const amount = BigInt(poxInfo.min_amount_ustx) / 2n;

    const delegationResult = await client.delegateStx({
      delegateTo: delegatorAddress,
      amountMicroStx: amount,
      untilBurnBlockHeight: (poxInfo.current_burnchain_block_height as number) + 50,
      poxAddress: delegatorPoxAddress,
      privateKey,
    });
    await waitForTx(delegationResult.txid);

    const delegationStatus = await client.getDelegationStatus();
    expect(delegationStatus.delegated).toBeTruthy();

    let stackingStatus = await client.getStatus();
    expect(stackingStatus.stacked).toBeFalsy();

    poxInfo = await client.getPoxInfo();
    const stackingResult = await delegatorClient.delegateStackStx({
      stacker: address,
      amountMicroStx: amount,
      burnBlockHeight: poxInfo.current_burnchain_block_height as number,
      cycles: 2,
      poxAddress: delegatorPoxAddress,
      privateKey: delegatorPrivateKey,
    });
    await waitForTx(stackingResult.txid);

    setApiMocks({
      ...MOCK_POX_2_REGTEST,
      '/v2/accounts/STB44HYPYAT2BB2QE513NSP81HTMYWBJP02HPGK6?proof=0': `{"balance":"0x000000000000000000203219a6437170","locked":"0x0000000000000000000354d8c979be00","unlock_height":8000,"nonce":25}`,
      '/v2/contracts/call-read/ST000000000000000000002AMW42H/pox-2/get-stacker-info': `{"okay":true,"result":"0x0a0c000000041266697273742d7265776172642d6379636c65010000000000000000000000000000063e0b6c6f636b2d706572696f64010000000000000000000000000000000208706f782d616464720c0000000209686173686279746573020000001443596b5386f466863e25658ddf94bd0fadab00480776657273696f6e020000000100127265776172642d7365742d696e64657865730b00000000"}`,
    });

    stackingStatus = await client.getStatus();
    expect(stackingStatus.stacked).toBeTruthy();
  });

  test('delegate stack, delegator stack, and delegator extend stack', async () => {
    const privateKey = 'cb3df38053d132895220b9ce471f6b676db5b9bf0b4adefb55f2118ece2478df01';
    const address = 'STB44HYPYAT2BB2QE513NSP81HTMYWBJP02HPGK6';

    const delegatorPrivateKey =
      '21d43d2ae0da1d9d04cfcaac7d397a33733881081f0b2cd038062cf0ccbb752601';
    const delegatorAddress = 'ST11NJTTKGVT6D1HY4NJRVQWMQM7TVAR091EJ8P2Y';
    const delegatorPoxAddress = '1797Pp1o8A7a8X8Qs7ejXtYyw8gbecFK2b';

    const network = new StacksTestnet({ url: API_URL });
    const client = new StackingClient(address, network);
    const delegatorClient = new StackingClient(delegatorAddress, network);

    setApiMocks({
      ...MOCK_POX_2_REGTEST,
      '/v2/accounts/STB44HYPYAT2BB2QE513NSP81HTMYWBJP02HPGK6?proof=0': `{"balance":"0x0000000000000000002386f26fbce150","locked":"0x00000000000000000000000000000000","unlock_height":0,"nonce":27}`,
      '/v2/accounts/ST11NJTTKGVT6D1HY4NJRVQWMQM7TVAR091EJ8P2Y?proof=0': `{"balance":"0x0000000000000000002386f26fc063c0","locked":"0x00000000000000000000000000000000","unlock_height":0,"nonce":4}`,
      '/v2/contracts/call-read/ST000000000000000000002AMW42H/pox-2/get-delegation-info': `{"okay":true,"result":"0x0a0c000000040b616d6f756e742d75737478010000000000000000000354d8c979be000c64656c6567617465642d746f051a43596b5386f466863e25658ddf94bd0fadab004808706f782d616464720a0c0000000209686173686279746573020000001443596b5386f466863e25658ddf94bd0fadab00480776657273696f6e0200000001000d756e74696c2d6275726e2d68740a0100000000000000000000000000001fbd"}`,
      '/v2/contracts/call-read/ST000000000000000000002AMW42H/pox-2/get-stacker-info': `{"okay":true,"result":"0x09"}`,
    });

    let poxInfo = await client.getPoxInfo();
    const amount = BigInt(poxInfo.min_amount_ustx) / 2n;

    const delegationResult = await client.delegateStx({
      delegateTo: delegatorAddress,
      amountMicroStx: amount,
      untilBurnBlockHeight: (poxInfo.current_burnchain_block_height as number) + 50,
      poxAddress: delegatorPoxAddress,
      privateKey,
    });
    await waitForTx(delegationResult.txid);

    const delegationStatus = await client.getDelegationStatus();
    expect(delegationStatus.delegated).toBeTruthy();

    let stackingStatus = await client.getStatus();
    expect(stackingStatus.stacked).toBeFalsy();

    poxInfo = await client.getPoxInfo();
    const stackingResult = await delegatorClient.delegateStackStx({
      stacker: address,
      amountMicroStx: amount,
      burnBlockHeight: poxInfo.current_burnchain_block_height as number,
      cycles: 2,
      poxAddress: delegatorPoxAddress,
      privateKey: delegatorPrivateKey,
    });
    await waitForTx(stackingResult.txid);

    setApiMocks({
      ...MOCK_POX_2_REGTEST,
      '/v2/contracts/call-read/ST000000000000000000002AMW42H/pox-2/get-stacker-info': `{"okay":true,"result":"0x0a0c000000041266697273742d7265776172642d6379636c6501000000000000000000000000000006500b6c6f636b2d706572696f64010000000000000000000000000000000208706f782d616464720c0000000209686173686279746573020000001443596b5386f466863e25658ddf94bd0fadab00480776657273696f6e020000000100127265776172642d7365742d696e64657865730b00000000"}`,
      '/v2/accounts/STB44HYPYAT2BB2QE513NSP81HTMYWBJP02HPGK6?proof=0': `{"balance":"0x000000000000000000203219a642fc40","locked":"0x0000000000000000000354d8c979be00","unlock_height":8090,"nonce":28}`,
      '/v2/accounts/ST11NJTTKGVT6D1HY4NJRVQWMQM7TVAR091EJ8P2Y?proof=0': `{"balance":"0x0000000000000000002386f26fc03cb0","locked":"0x00000000000000000000000000000000","unlock_height":0,"nonce":5}`,
    });

    stackingStatus = await client.getStatus();
    if (!stackingStatus.stacked) throw Error;

    const EXTEND_COUNT = 2;
    const extendResult = await delegatorClient.delegateStackExtend({
      stacker: address,
      poxAddress: delegatorPoxAddress,
      extendCount: EXTEND_COUNT,
      privateKey: delegatorPrivateKey,
    });
    await waitForTx(extendResult.txid);

    setApiMocks({
      ...MOCK_POX_2_REGTEST,
      '/v2/accounts/STB44HYPYAT2BB2QE513NSP81HTMYWBJP02HPGK6?proof=0': `{"balance":"0x000000000000000000203219a642fc40","locked":"0x0000000000000000000354d8c979be00","unlock_height":8100,"nonce":28}`,
      '/v2/contracts/call-read/ST000000000000000000002AMW42H/pox-2/get-stacker-info': `{"okay":true,"result":"0x0a0c000000041266697273742d7265776172642d6379636c6501000000000000000000000000000006500b6c6f636b2d706572696f64010000000000000000000000000000000408706f782d616464720c0000000209686173686279746573020000001443596b5386f466863e25658ddf94bd0fadab00480776657273696f6e020000000100127265776172642d7365742d696e64657865730b00000000"}`,
    });

    const finalStatus = await client.getStatus();
    if (!finalStatus.stacked) throw Error;

    const expectedUnlockHeight =
      stackingStatus.details.unlock_height +
      EXTEND_COUNT * (poxInfo.prepare_phase_block_length + poxInfo.reward_phase_block_length);
    expect(finalStatus.details.unlock_height).toBe(expectedUnlockHeight);
    expect(finalStatus.details.unlock_height).toBeGreaterThan(stackingStatus.details.unlock_height);
  });

  test('delegate stack, delegator stack, and delegator increase stack', async () => {
    const privateKey = 'cb3df38053d132895220b9ce471f6b676db5b9bf0b4adefb55f2118ece2478df01';
    const address = 'STB44HYPYAT2BB2QE513NSP81HTMYWBJP02HPGK6';

    const delegatorPrivateKey =
      '21d43d2ae0da1d9d04cfcaac7d397a33733881081f0b2cd038062cf0ccbb752601';
    const delegatorAddress = 'ST11NJTTKGVT6D1HY4NJRVQWMQM7TVAR091EJ8P2Y';
    const delegatorPoxAddress = '1797Pp1o8A7a8X8Qs7ejXtYyw8gbecFK2b';

    const network = new StacksTestnet({ url: API_URL });
    const client = new StackingClient(address, network);
    const delegatorClient = new StackingClient(delegatorAddress, network);

    setApiMocks({
      ...MOCK_POX_2_REGTEST,
      '/v2/accounts/STB44HYPYAT2BB2QE513NSP81HTMYWBJP02HPGK6?proof=0': `{"balance":"0x0000000000000000002386f26fbc6c20","locked":"0x00000000000000000000000000000000","unlock_height":0,"nonce":30}`,
      '/v2/accounts/ST11NJTTKGVT6D1HY4NJRVQWMQM7TVAR091EJ8P2Y?proof=0': `{"balance":"0x0000000000000000002386f26fbfc780","locked":"0x00000000000000000000000000000000","unlock_height":0,"nonce":8}`,
      '/v2/contracts/call-read/ST000000000000000000002AMW42H/pox-2/get-delegation-info': `{"okay":true,"result":"0x0a0c000000040b616d6f756e742d757374780100000000000000000006a9b3e6ff60000c64656c6567617465642d746f051a43596b5386f466863e25658ddf94bd0fadab004808706f782d616464720a0c0000000209686173686279746573020000001443596b5386f466863e25658ddf94bd0fadab00480776657273696f6e0200000001000d756e74696c2d6275726e2d68740a010000000000000000000000000000206b"}`,
      '/v2/contracts/call-read/ST000000000000000000002AMW42H/pox-2/get-stacker-info': `{"okay":true,"result":"0x09"}`,
    });

    let poxInfo = await client.getPoxInfo();
    const fullAmount = BigInt(poxInfo.min_amount_ustx);

    const delegationResult = await client.delegateStx({
      delegateTo: delegatorAddress,
      amountMicroStx: fullAmount,
      untilBurnBlockHeight: (poxInfo.current_burnchain_block_height as number) + 50,
      poxAddress: delegatorPoxAddress,
      privateKey,
    });
    await waitForTx(delegationResult.txid);

    const delegationStatus = await client.getDelegationStatus();
    expect(delegationStatus.delegated).toBeTruthy();

    let stackingStatus = await client.getStatus();
    expect(stackingStatus.stacked).toBeFalsy();

    poxInfo = await client.getPoxInfo();
    const stackingResult = await delegatorClient.delegateStackStx({
      stacker: address,
      amountMicroStx: fullAmount / 2n,
      burnBlockHeight: poxInfo.current_burnchain_block_height as number,
      cycles: 2,
      poxAddress: delegatorPoxAddress,
      privateKey: delegatorPrivateKey,
    });
    await waitForTx(stackingResult.txid);

    setApiMocks({
      ...MOCK_POX_2_REGTEST,
      '/v2/accounts/STB44HYPYAT2BB2QE513NSP81HTMYWBJP02HPGK6?proof=0': `{"balance":"0x0000000000000000002032187c3c9510","locked":"0x0000000000000000000354d9f37fb000","unlock_height":8265,"nonce":31}`,
      '/v2/accounts/ST11NJTTKGVT6D1HY4NJRVQWMQM7TVAR091EJ8P2Y?proof=0': `{"balance":"0x0000000000000000002386f26fbfa070","locked":"0x00000000000000000000000000000000","unlock_height":0,"nonce":9}`,
      '/v2/contracts/call-read/ST000000000000000000002AMW42H/pox-2/get-stacker-info': `{"okay":true,"result":"0x0a0c000000041266697273742d7265776172642d6379636c6501000000000000000000000000000006730b6c6f636b2d706572696f64010000000000000000000000000000000208706f782d616464720c0000000209686173686279746573020000001443596b5386f466863e25658ddf94bd0fadab00480776657273696f6e020000000100127265776172642d7365742d696e64657865730b00000000"}`,
    });

    stackingStatus = await client.getStatus();
    if (!stackingStatus.stacked) throw Error;

    let balanceLocked = await client.getAccountBalanceLocked();
    expect(balanceLocked).toBe(fullAmount / 2n);

    const extendResult = await delegatorClient.delegateStackIncrease({
      stacker: address,
      poxAddress: delegatorPoxAddress,
      increaseBy: fullAmount / 2n,
      privateKey: delegatorPrivateKey,
    });
    await waitForTx(extendResult.txid);

    setApiMocks({
      ...MOCK_POX_2_REGTEST,
      '/v2/accounts/STB44HYPYAT2BB2QE513NSP81HTMYWBJP02HPGK6?proof=0': `{"balance":"0x0000000000000000001cdd3e88bce510","locked":"0x00000000000000000006a9b3e6ff6000","unlock_height":8265,"nonce":31}`,
      '/v2/contracts/call-read/ST000000000000000000002AMW42H/pox-2/get-stacker-info': `{"okay":true,"result":"0x0a0c000000041266697273742d7265776172642d6379636c6501000000000000000000000000000006730b6c6f636b2d706572696f64010000000000000000000000000000000208706f782d616464720c0000000209686173686279746573020000001443596b5386f466863e25658ddf94bd0fadab00480776657273696f6e020000000100127265776172642d7365742d696e64657865730b00000000"}`,
    });

    stackingStatus = await client.getStatus();
    if (!stackingStatus.stacked) throw Error;

    balanceLocked = await client.getAccountBalanceLocked();
    expect(balanceLocked).toBe(fullAmount);
  });

  test('delegator stacks for multiple stackers in a pool (compatible with pox-1)', async () => {
    // Prerequisites:
    // * Assumes no other stackers are stacking for these reward cycles
    // Step-by-step:
    // * Two stackers (A and B) delegate to a pool
    // * The pool stacks for both stackers (partially)
    // * The pool commits a total stacking amount (covering all of its stackers)
    //   * This is required for a pools pox-address to be "commited" into the reward-set

    const network = new StacksTestnet({ url: API_URL });

    const stackerAKey = 'cb3df38053d132895220b9ce471f6b676db5b9bf0b4adefb55f2118ece2478df01';
    const stackerAAddress = 'STB44HYPYAT2BB2QE513NSP81HTMYWBJP02HPGK6';
    const clientA = new StackingClient(stackerAAddress, network);

    const stackerBKey = 'c71700b07d520a8c9731e4d0f095aa6efb91e16e25fb27ce2b72e7b698f8127a01';
    const stackerBAddress = 'ST1HB1T8WRNBYB0Y3T7WXZS38NKKPTBR3EG9EPJKR';
    const clientB = new StackingClient(stackerBAddress, network);

    const poolPrivateKey = '21d43d2ae0da1d9d04cfcaac7d397a33733881081f0b2cd038062cf0ccbb752601';
    const poolAddress = 'ST11NJTTKGVT6D1HY4NJRVQWMQM7TVAR091EJ8P2Y';
    const poolPoxAddress = '1797Pp1o8A7a8X8Qs7ejXtYyw8gbecFK2b';
    const clientPool = new StackingClient(poolAddress, network);

    setApiMocks({
      ...MOCK_POX_2_REGTEST,
      '/v2/pox': `{"contract_id":"ST000000000000000000002AMW42H.pox-2","pox_activation_threshold_ustx":600072605053055,"first_burnchain_block_height":0,"current_burnchain_block_height":1710,"prepare_phase_block_length":1,"reward_phase_block_length":4,"reward_slots":8,"rejection_fraction":3333333333333333,"total_liquid_supply_ustx":60007260505305579,"current_cycle":{"id":341,"min_threshold_ustx":1875230000000000,"stacked_ustx":0,"is_pox_active":false},"next_cycle":{"id":342,"min_threshold_ustx":1875230000000000,"min_increment_ustx":7500907563163,"stacked_ustx":0,"prepare_phase_start_block_height":1714,"blocks_until_prepare_phase":4,"reward_phase_start_block_height":1715,"blocks_until_reward_phase":5,"ustx_until_pox_rejection":17088607629875529003},"min_amount_ustx":1875230000000000,"prepare_cycle_length":1,"reward_cycle_id":341,"reward_cycle_length":5,"rejection_votes_left_required":17088607629875529003,"next_reward_cycle_in":5,"contract_versions":[{"contract_id":"ST000000000000000000002AMW42H.pox","activation_burnchain_block_height":0,"first_reward_cycle_id":0},{"contract_id":"ST000000000000000000002AMW42H.pox-2","activation_burnchain_block_height":120,"first_reward_cycle_id":25}]}`,
      '/v2/accounts/STB44HYPYAT2BB2QE513NSP81HTMYWBJP02HPGK6?proof=0': `{"balance":"0x0000000000000000002386f26fc015a0","locked":"0x00000000000000000000000000000000","unlock_height":0,"nonce":6}`,
      '/v2/accounts/ST1HB1T8WRNBYB0Y3T7WXZS38NKKPTBR3EG9EPJKR?proof=0': `{"balance":"0x0000000000000000002386f26fc015a0","locked":"0x00000000000000000000000000000000","unlock_height":0,"nonce":6}`,
    });

    let poxInfo = await clientPool.getPoxInfo();
    const START_BLOCK_HEIGHT = poxInfo.current_burnchain_block_height as number;
    const DELEGATE_UNTIL = START_BLOCK_HEIGHT + 25;
    const FULL_AMOUNT = BigInt(poxInfo.min_amount_ustx);
    const HALF_AMOUNT = FULL_AMOUNT / 2n;

    // Stacker A delegates half the funds
    const delegateA = await clientA.delegateStx({
      delegateTo: poolAddress,
      amountMicroStx: HALF_AMOUNT,
      untilBurnBlockHeight: DELEGATE_UNTIL,
      poxAddress: poolPoxAddress,
      privateKey: stackerAKey,
    });

    // Stacker B delegates the other half of the funds
    const delegateB = await clientA.delegateStx({
      delegateTo: poolAddress,
      amountMicroStx: HALF_AMOUNT,
      untilBurnBlockHeight: DELEGATE_UNTIL,
      poxAddress: poolPoxAddress,
      privateKey: stackerBKey,
    });

    await waitForTx(delegateA.txid);
    await waitForTx(delegateB.txid);

    setApiMocks({
      ...MOCK_POX_2_REGTEST,
      '/v2/pox': `{"contract_id":"ST000000000000000000002AMW42H.pox-2","pox_activation_threshold_ustx":600072615157055,"first_burnchain_block_height":0,"current_burnchain_block_height":1711,"prepare_phase_block_length":1,"reward_phase_block_length":4,"reward_slots":8,"rejection_fraction":3333333333333333,"total_liquid_supply_ustx":60007261515705579,"current_cycle":{"id":342,"min_threshold_ustx":1875230000000000,"stacked_ustx":0,"is_pox_active":false},"next_cycle":{"id":343,"min_threshold_ustx":1875230000000000,"min_increment_ustx":7500907689463,"stacked_ustx":0,"prepare_phase_start_block_height":1714,"blocks_until_prepare_phase":3,"reward_phase_start_block_height":1715,"blocks_until_reward_phase":4,"ustx_until_pox_rejection":13333929036230910187},"min_amount_ustx":1875230000000000,"prepare_cycle_length":1,"reward_cycle_id":342,"reward_cycle_length":5,"rejection_votes_left_required":13333929036230910187,"next_reward_cycle_in":4,"contract_versions":[{"contract_id":"ST000000000000000000002AMW42H.pox","activation_burnchain_block_height":0,"first_reward_cycle_id":0},{"contract_id":"ST000000000000000000002AMW42H.pox-2","activation_burnchain_block_height":120,"first_reward_cycle_id":25}]}`,
      '/v2/contracts/call-read/ST000000000000000000002AMW42H/pox-2/get-delegation-info': `{"okay":true,"result":"0x0a0c000000040b616d6f756e742d75737478010000000000000000000354c18102d6000c64656c6567617465642d746f051a43596b5386f466863e25658ddf94bd0fadab004808706f782d616464720a0c0000000209686173686279746573020000001443596b5386f466863e25658ddf94bd0fadab00480776657273696f6e0200000001000d756e74696c2d6275726e2d68740a01000000000000000000000000000006c7"}`,
      '/v2/accounts/ST11NJTTKGVT6D1HY4NJRVQWMQM7TVAR091EJ8P2Y?proof=0': `{"balance":"0x0000000000000000002386f26fbda4a0","locked":"0x00000000000000000000000000000000","unlock_height":0,"nonce":22}`,
    });

    const delegationStatusA = await clientA.getDelegationStatus();
    expect(delegationStatusA.delegated).toBeTruthy();

    const delegationStatusB = await clientB.getDelegationStatus();
    expect(delegationStatusB.delegated).toBeTruthy();

    poxInfo = await clientPool.getPoxInfo();

    // Manual nonce setting is required for multiple transactions in the same block
    let noncePool = await getNonce(poolAddress, network);

    // Pool stacks for stacker A
    const stackAPool = await clientPool.delegateStackStx({
      stacker: stackerAAddress,
      amountMicroStx: HALF_AMOUNT,
      burnBlockHeight: poxInfo.current_burnchain_block_height as number,
      cycles: 2,
      poxAddress: poolPoxAddress,
      privateKey: poolPrivateKey,
      nonce: noncePool++,
    });

    // Pool stacks for stacker B
    const stackBPool = await clientPool.delegateStackStx({
      stacker: stackerBAddress,
      amountMicroStx: HALF_AMOUNT,
      burnBlockHeight: poxInfo.current_burnchain_block_height as number,
      cycles: 2,
      poxAddress: poolPoxAddress,
      privateKey: poolPrivateKey,
      nonce: noncePool++,
    });

    await waitForTx(stackAPool.txid);
    await waitForTx(stackBPool.txid);

    setApiMocks({
      ...MOCK_POX_2_REGTEST,
      '/v2/contracts/call-read/ST000000000000000000002AMW42H/pox-2/get-stacker-info': `{"okay":true,"result":"0x0a0c000000041266697273742d7265776172642d6379636c6501000000000000000000000000000001570b6c6f636b2d706572696f64010000000000000000000000000000000208706f782d616464720c0000000209686173686279746573020000001443596b5386f466863e25658ddf94bd0fadab00480776657273696f6e020000000100127265776172642d7365742d696e64657865730b00000000"}`,
      '/v2/accounts/STB44HYPYAT2BB2QE513NSP81HTMYWBJP02HPGK6?proof=0': `{"balance":"0x000000000000000000203230eebd1890","locked":"0x0000000000000000000354c18102d600","unlock_height":1725,"nonce":7}`,
      '/v2/accounts/ST1HB1T8WRNBYB0Y3T7WXZS38NKKPTBR3EG9EPJKR?proof=0': `{"balance":"0x000000000000000000203230eebd1890","locked":"0x0000000000000000000354c18102d600","unlock_height":1725,"nonce":7}`,
      '/v2/accounts/ST11NJTTKGVT6D1HY4NJRVQWMQM7TVAR091EJ8P2Y?proof=0': `{"balance":"0x0000000000000000002386f26fbd5680","locked":"0x00000000000000000000000000000000","unlock_height":0,"nonce":24}`,
    });

    // Balances are now locked for stackers (only partially stacked at this point)
    const stackingStatusA = await clientA.getStatus();
    if (!stackingStatusA.stacked) throw Error;

    const stackingStatusB = await clientB.getStatus();
    if (!stackingStatusB.stacked) throw Error;

    expect(
      stackingStatusA.details.first_reward_cycle === stackingStatusB.details.first_reward_cycle
    ).toBeTruthy();

    const balanceLockedA = await clientA.getAccountBalanceLocked();
    expect(balanceLockedA).toBe(HALF_AMOUNT);

    const balanceLockedB = await clientB.getAccountBalanceLocked();
    expect(balanceLockedB).toBe(HALF_AMOUNT);

    const commitPool = await clientPool.stackAggregationCommit({
      poxAddress: poolPoxAddress,
      privateKey: poolPrivateKey,
      rewardCycle: stackingStatusA.details.first_reward_cycle,
    });

    await waitForTx(commitPool.txid);
    await waitForCycle(stackingStatusA.details.first_reward_cycle);

    setApiMocks({
      '/v2/contracts/call-read/ST000000000000000000002AMW42H/pox-2/get-reward-set-pox-address': `{"okay":true,"result":"0x0a0c0000000308706f782d616464720c0000000209686173686279746573020000001443596b5386f466863e25658ddf94bd0fadab00480776657273696f6e02000000010007737461636b6572090a746f74616c2d757374780100000000000000000006a9830205ac00"}`,
    });

    const rewardSet = await clientPool.getRewardSet({
      contractId: poxInfo.contract_id,
      rewardCyleId: stackingStatusA.details.first_reward_cycle,
      rewardSetIndex: 0, // first and only entry in reward set
    });
    expect(rewardSet).toBeDefined();
    expect(rewardSet?.total_ustx).toBe(FULL_AMOUNT);
    expect(rewardSet?.pox_address.version[0]).toEqual(decodeBtcAddress(poolPoxAddress).version);
    expect(rewardSet?.pox_address.hashbytes).toEqual(decodeBtcAddress(poolPoxAddress).data);
  });

  test('delegator stacks for multiple stackers in a pool, then increases commitment (requires pox-2)', async () => {
    // Prerequisites:
    // * Assumes no other stackers are stacking for these reward cycles
    // Step-by-step:
    // * Two stackers (A and B) delegate to a pool
    //   * Both provide more than half the required funds
    // * The pool stacks some of the funds for both stackers (partially)
    //   * The pool didn't realize how much it could stack and only stacks the minimum amount (even though more was delegated)
    // * The pool commits a total stacking amount (not yet covering the full amount of its stackers)
    // * The pool realizes the mistake and increases the amount to all of its stackers' funds
    //   * This will only work if the reward cycle anchor block hasn't been reached yet!

    const network = new StacksTestnet({ url: API_URL });

    const stackerAKey = 'cb3df38053d132895220b9ce471f6b676db5b9bf0b4adefb55f2118ece2478df01';
    const stackerAAddress = 'STB44HYPYAT2BB2QE513NSP81HTMYWBJP02HPGK6';
    const clientA = new StackingClient(stackerAAddress, network);

    const stackerBKey = 'c71700b07d520a8c9731e4d0f095aa6efb91e16e25fb27ce2b72e7b698f8127a01';
    const stackerBAddress = 'ST1HB1T8WRNBYB0Y3T7WXZS38NKKPTBR3EG9EPJKR';
    const clientB = new StackingClient(stackerBAddress, network);

    const poolPrivateKey = '21d43d2ae0da1d9d04cfcaac7d397a33733881081f0b2cd038062cf0ccbb752601';
    const poolAddress = 'ST11NJTTKGVT6D1HY4NJRVQWMQM7TVAR091EJ8P2Y';
    const poolPoxAddress = '1797Pp1o8A7a8X8Qs7ejXtYyw8gbecFK2b';
    const clientPool = new StackingClient(poolAddress, network);

    setApiMocks({
      ...MOCK_POX_2_REGTEST,
      '/v2/pox': `{"contract_id":"ST000000000000000000002AMW42H.pox-2","pox_activation_threshold_ustx":600070180093055,"first_burnchain_block_height":0,"current_burnchain_block_height":1470,"prepare_phase_block_length":1,"reward_phase_block_length":4,"reward_slots":8,"rejection_fraction":3333333333333333,"total_liquid_supply_ustx":60007018009305579,"current_cycle":{"id":293,"min_threshold_ustx":1875220000000000,"stacked_ustx":0,"is_pox_active":false},"next_cycle":{"id":294,"min_threshold_ustx":1875220000000000,"min_increment_ustx":7500877251163,"stacked_ustx":0,"prepare_phase_start_block_height":1474,"blocks_until_prepare_phase":4,"reward_phase_start_block_height":1475,"blocks_until_reward_phase":5,"ustx_until_pox_rejection":14321010492816015659},"min_amount_ustx":1875220000000000,"prepare_cycle_length":1,"reward_cycle_id":293,"reward_cycle_length":5,"rejection_votes_left_required":14321010492816015659,"next_reward_cycle_in":5,"contract_versions":[{"contract_id":"ST000000000000000000002AMW42H.pox","activation_burnchain_block_height":0,"first_reward_cycle_id":0},{"contract_id":"ST000000000000000000002AMW42H.pox-2","activation_burnchain_block_height":120,"first_reward_cycle_id":25}]}`,
      // Stacker A
      '/v2/accounts/STB44HYPYAT2BB2QE513NSP81HTMYWBJP02HPGK6?proof=0': `{"balance":"0x0000000000000000002386f26fc03cb0","locked":"0x00000000000000000000000000000000","unlock_height":0,"nonce":5}`,
      // Stacker B
      '/v2/accounts/ST1HB1T8WRNBYB0Y3T7WXZS38NKKPTBR3EG9EPJKR?proof=0': `{"balance":"0x0000000000000000002386f26fc03cb0","locked":"0x00000000000000000000000000000000","unlock_height":0,"nonce":5}`,
    });

    let poxInfo = await clientPool.getPoxInfo();
    const START_BLOCK_HEIGHT = poxInfo.current_burnchain_block_height as number;
    const DELEGATE_UNTIL = START_BLOCK_HEIGHT + 25;
    const FULL_AMOUNT = BigInt(poxInfo.min_amount_ustx); // full amount required for a reward set
    const HALF_AMOUNT = FULL_AMOUNT / 2n;
    const AMOUNT_75 = BigInt(Number(FULL_AMOUNT) * 0.75); // 3/4 of the required funds

    // Stacker A delegates some funds
    const delegateA = await clientA.delegateStx({
      delegateTo: poolAddress,
      amountMicroStx: AMOUNT_75,
      untilBurnBlockHeight: DELEGATE_UNTIL,
      poxAddress: poolPoxAddress,
      privateKey: stackerAKey,
    });

    // Stacker B delegates some funds
    const delegateB = await clientA.delegateStx({
      delegateTo: poolAddress,
      amountMicroStx: AMOUNT_75,
      untilBurnBlockHeight: DELEGATE_UNTIL,
      poxAddress: poolPoxAddress,
      privateKey: stackerBKey,
    });

    await waitForTx(delegateA.txid);
    await waitForTx(delegateB.txid);

    setApiMocks({
      ...MOCK_POX_2_REGTEST,
      '/v2/pox': `{"contract_id":"ST000000000000000000002AMW42H.pox-2","pox_activation_threshold_ustx":600070190197055,"first_burnchain_block_height":0,"current_burnchain_block_height":1471,"prepare_phase_block_length":1,"reward_phase_block_length":4,"reward_slots":8,"rejection_fraction":3333333333333333,"total_liquid_supply_ustx":60007019019705579,"current_cycle":{"id":294,"min_threshold_ustx":1875220000000000,"stacked_ustx":0,"is_pox_active":false},"next_cycle":{"id":295,"min_threshold_ustx":1875220000000000,"min_increment_ustx":7500877377463,"stacked_ustx":0,"prepare_phase_start_block_height":1474,"blocks_until_prepare_phase":3,"reward_phase_start_block_height":1475,"blocks_until_reward_phase":4,"ustx_until_pox_rejection":10566331899171396843},"min_amount_ustx":1875220000000000,"prepare_cycle_length":1,"reward_cycle_id":294,"reward_cycle_length":5,"rejection_votes_left_required":10566331899171396843,"next_reward_cycle_in":4,"contract_versions":[{"contract_id":"ST000000000000000000002AMW42H.pox","activation_burnchain_block_height":0,"first_reward_cycle_id":0},{"contract_id":"ST000000000000000000002AMW42H.pox-2","activation_burnchain_block_height":120,"first_reward_cycle_id":25}]}`,
      // Pool
      '/v2/accounts/ST11NJTTKGVT6D1HY4NJRVQWMQM7TVAR091EJ8P2Y?proof=0': `{"balance":"0x0000000000000000002386f26fbe67f0","locked":"0x00000000000000000000000000000000","unlock_height":0,"nonce":17}`,
    });

    poxInfo = await clientPool.getPoxInfo();

    // Manual nonce setting is required for multiple transactions in the same block
    let noncePool = await getNonce(poolAddress, network);

    // Pool stacks for stacker A (stacks all 3/4)
    const stackAPool = await clientPool.delegateStackStx({
      stacker: stackerAAddress,
      amountMicroStx: AMOUNT_75,
      burnBlockHeight: poxInfo.current_burnchain_block_height as number,
      cycles: 2,
      poxAddress: poolPoxAddress,
      privateKey: poolPrivateKey,
      nonce: noncePool++,
    });

    // Pool stacks for stacker B (stacks only 1/2)
    const stackBPool = await clientPool.delegateStackStx({
      stacker: stackerBAddress,
      amountMicroStx: HALF_AMOUNT,
      burnBlockHeight: poxInfo.current_burnchain_block_height as number,
      cycles: 2,
      poxAddress: poolPoxAddress,
      privateKey: poolPrivateKey,
      nonce: noncePool++,
    });

    await waitForTx(stackAPool.txid);
    await waitForTx(stackBPool.txid);

    setApiMocks({
      ...MOCK_POX_2_REGTEST,
      '/v2/pox': `{"contract_id":"ST000000000000000000002AMW42H.pox-2","pox_activation_threshold_ustx":600070200301055,"first_burnchain_block_height":0,"current_burnchain_block_height":1472,"prepare_phase_block_length":1,"reward_phase_block_length":4,"reward_slots":8,"rejection_fraction":3333333333333333,"total_liquid_supply_ustx":60007020030105579,"current_cycle":{"id":294,"min_threshold_ustx":1875220000000000,"stacked_ustx":0,"is_pox_active":false},"next_cycle":{"id":295,"min_threshold_ustx":1875220000000000,"min_increment_ustx":7500877503763,"stacked_ustx":0,"prepare_phase_start_block_height":1474,"blocks_until_prepare_phase":2,"reward_phase_start_block_height":1475,"blocks_until_reward_phase":3,"ustx_until_pox_rejection":6811653305526778027},"min_amount_ustx":1875220000000000,"prepare_cycle_length":1,"reward_cycle_id":294,"reward_cycle_length":5,"rejection_votes_left_required":6811653305526778027,"next_reward_cycle_in":3,"contract_versions":[{"contract_id":"ST000000000000000000002AMW42H.pox","activation_burnchain_block_height":0,"first_reward_cycle_id":0},{"contract_id":"ST000000000000000000002AMW42H.pox-2","activation_burnchain_block_height":120,"first_reward_cycle_id":25}]}`,
      '/v2/contracts/call-read/ST000000000000000000002AMW42H/pox-2/get-stacker-info': `{"okay":true,"result":"0x0a0c000000041266697273742d7265776172642d6379636c6501000000000000000000000000000001270b6c6f636b2d706572696f64010000000000000000000000000000000208706f782d616464720c0000000209686173686279746573020000001443596b5386f466863e25658ddf94bd0fadab00480776657273696f6e020000000100127265776172642d7365742d696e64657865730b00000000"}`,
      // Stacker A
      '/v2/accounts/STB44HYPYAT2BB2QE513NSP81HTMYWBJP02HPGK6?proof=0': `{"balance":"0x0000000000000000001e87d1ed44bfa0","locked":"0x00000000000000000004ff20827b5600","unlock_height":1485,"nonce":6}`,
      // Stacker B
      '/v2/accounts/ST1HB1T8WRNBYB0Y3T7WXZS38NKKPTBR3EG9EPJKR?proof=0': `{"balance":"0x00000000000000000020323218c331a0","locked":"0x0000000000000000000354c056fce400","unlock_height":1485,"nonce":6}`,
      // Pool
      '/v2/accounts/ST11NJTTKGVT6D1HY4NJRVQWMQM7TVAR091EJ8P2Y?proof=0': `{"balance":"0x0000000000000000002386f26fbe19d0","locked":"0x00000000000000000000000000000000","unlock_height":0,"nonce":19}`,
    });

    // Balances are now locked for stackers (only partially stacked at this point)
    const stackingStatusA = await clientA.getStatus();
    if (!stackingStatusA.stacked) throw Error;

    const stackingStatusB = await clientB.getStatus();
    if (!stackingStatusB.stacked) throw Error;

    expect(
      stackingStatusA.details.first_reward_cycle === stackingStatusB.details.first_reward_cycle
    ).toBeTruthy();

    const balanceLockedA = await clientA.getAccountBalanceLocked();
    expect(balanceLockedA).toBe(AMOUNT_75);

    const balanceLockedB = await clientB.getAccountBalanceLocked();
    expect(balanceLockedB).toBe(HALF_AMOUNT);

    // In this test the pool uses the new .stackAggregationCommitIndexed (PoX-2)
    // Which is basically the same as .stackAggregationCommit, but the tx will
    // return the commits index in the reward set
    const commitIndexed = await clientPool.stackAggregationCommitIndexed({
      poxAddress: poolPoxAddress,
      privateKey: poolPrivateKey,
      rewardCycle: stackingStatusA.details.first_reward_cycle,
    });

    await waitForTx(commitIndexed.txid);

    // Oops, the pool realized they didn't stack all delegated funds for stacker B
    // Pool increases for stacker B (to all 3/4)
    const increaseBPool = await clientPool.delegateStackIncrease({
      stacker: stackerBAddress,
      increaseBy: AMOUNT_75 - HALF_AMOUNT, // increase by the missing amount
      poxAddress: poolPoxAddress,
      privateKey: poolPrivateKey,
    });

    await waitForTx(increaseBPool.txid);

    const commitIncrease = await clientPool.stackAggregationIncrease({
      poxAddress: poolPoxAddress,
      privateKey: poolPrivateKey,
      rewardCycle: stackingStatusA.details.first_reward_cycle,
      rewardIndex: 0, // would now also be returned by the commitIndexed tx
    });

    await waitForTx(commitIncrease.txid);
    // to be included, the latest commit (increase) needs to be mined before the reward cycles' anchor block
    await waitForCycle(stackingStatusA.details.first_reward_cycle);

    setApiMocks({
      '/v2/contracts/call-read/ST000000000000000000002AMW42H/pox-2/get-reward-set-pox-address': `{"okay":true,"result":"0x0a0c0000000308706f782d616464720c0000000209686173686279746573020000001443596b5386f466863e25658ddf94bd0fadab00480776657273696f6e02000000010007737461636b6572090a746f74616c2d757374780100000000000000000009fe4104f6ac00"}`,
    });

    const rewardSet = await clientPool.getRewardSet({
      contractId: poxInfo.contract_id,
      rewardCyleId: stackingStatusA.details.first_reward_cycle,
      rewardSetIndex: 0,
    });
    expect(rewardSet).toBeDefined();
    expect(rewardSet?.total_ustx).toBe(AMOUNT_75 * 2n); // 1.5x the FULL_AMOUNT (aka everything the stackers stacked together)
    expect(rewardSet?.pox_address.version[0]).toEqual(decodeBtcAddress(poolPoxAddress).version);
    expect(rewardSet?.pox_address.hashbytes).toEqual(decodeBtcAddress(poolPoxAddress).data);
  });
});

describe('btc addresses', () => {
  test('stack to pox-1 with non-b58 addresses throws', async () => {
    const privateKey = 'cb3df38053d132895220b9ce471f6b676db5b9bf0b4adefb55f2118ece2478df01';
    const address = 'STB44HYPYAT2BB2QE513NSP81HTMYWBJP02HPGK6';

    const poxAddressNativeSegwitP2WPKH = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4';
    const poxAddressNativeSegwitP2WSH =
      'bc1p5d7rjq7g6rdk2yhzks9smlaqtedr4dekq08ge8ztwac72sfr9rusxg3297';

    const network = new StacksTestnet({ url: API_URL });
    const client = new StackingClient(address, network);

    setApiMocks({
      '/v2/pox': `{"contract_id":"ST000000000000000000002AMW42H.pox","pox_activation_threshold_ustx":600057388429055,"first_burnchain_block_height":0,"current_burnchain_block_height":107,"prepare_phase_block_length":1,"reward_phase_block_length":4,"reward_slots":8,"rejection_fraction":3333333333333333,"total_liquid_supply_ustx":60005738842905579,"current_cycle":{"id":21,"min_threshold_ustx":1875180000000000,"stacked_ustx":0,"is_pox_active":false},"next_cycle":{"id":22,"min_threshold_ustx":1875180000000000,"min_increment_ustx":7500717355363,"stacked_ustx":0,"prepare_phase_start_block_height":109,"blocks_until_prepare_phase":2,"reward_phase_start_block_height":110,"blocks_until_reward_phase":3,"ustx_until_pox_rejection":8484139029839119787},"min_amount_ustx":1875180000000000,"prepare_cycle_length":1,"reward_cycle_id":21,"reward_cycle_length":5,"rejection_votes_left_required":8484139029839119787,"next_reward_cycle_in":3,"contract_versions":[{"contract_id":"ST000000000000000000002AMW42H.pox","activation_burnchain_block_height":0,"first_reward_cycle_id":0},{"contract_id":"ST000000000000000000002AMW42H.pox-2","activation_burnchain_block_height":120,"first_reward_cycle_id":25}]}`,
      '/v2/data_var/ST000000000000000000002AMW42H/pox-2/configured?proof=0': `Data var not found`,
      '/v2/accounts/STB44HYPYAT2BB2QE513NSP81HTMYWBJP02HPGK6?proof=0': `{"balance":"0x0000000000000000001cdd7b11f6a0f0","locked":"0x00000000000000000006a9775dca3800","unlock_height":170,"nonce":1}`,
      '/v2/contracts/interface/ST000000000000000000002AMW42H/pox': V2_POX_INTERFACE_POX_2,
    });

    const poxOperation = await client.getPoxOperationInfo();
    expect(poxOperation.period).toBe(PoxOperationPeriod.Period1);

    const poxInfo = await client.getPoxInfo();

    await expect(
      client.stack({
        amountMicroStx: poxInfo.min_amount_ustx,
        burnBlockHeight: poxInfo.next_cycle.prepare_phase_start_block_height,
        cycles: 1,
        poxAddress: poxAddressNativeSegwitP2WPKH,
        privateKey,
      })
    ).rejects.toThrow();

    await expect(
      client.stack({
        amountMicroStx: poxInfo.min_amount_ustx,
        burnBlockHeight: poxInfo.next_cycle.prepare_phase_start_block_height,
        cycles: 1,
        poxAddress: poxAddressNativeSegwitP2WSH,
        privateKey,
      })
    ).rejects.toThrow();
  });

  test.each(BTC_ADDRESS_CASES)(
    'stack with btc address',
    async ({ address: btcAddress, expectedHash, expectedVersion, mockedResult }) => {
      const privateKey = 'cb3df38053d132895220b9ce471f6b676db5b9bf0b4adefb55f2118ece2478df01';
      const address = 'STB44HYPYAT2BB2QE513NSP81HTMYWBJP02HPGK6';

      const network = new StacksTestnet({ url: API_URL });
      const client = new StackingClient(address, network);

      setApiMocks({
        ...MOCK_POX_2_REGTEST,
        '/v2/accounts/STB44HYPYAT2BB2QE513NSP81HTMYWBJP02HPGK6?proof=0': `{"balance":"0x0000000000000000002386f26fbe67f0","locked":"0x00000000000000000000000000000000","unlock_height":0,"nonce":17}`,
        '/v2/contracts/call-read/ST000000000000000000002AMW42H/pox-2/get-stacker-info': `{"okay":true,"result":"0x09"}`,
      });

      const poxInfo = await client.getPoxInfo();
      const stackingResult = await client.stack({
        amountMicroStx: BigInt(poxInfo.min_amount_ustx),
        burnBlockHeight: (poxInfo.current_burnchain_block_height as number) + 1,
        poxAddress: btcAddress,
        cycles: 2,
        privateKey,
      });
      await waitForTx(stackingResult.txid);

      setApiMocks({
        ...MOCK_POX_2_REGTEST,
        '/v2/accounts/STB44HYPYAT2BB2QE513NSP81HTMYWBJP02HPGK6?proof=0': `{"balance":"0x0000000000000000001cdd687194e8e0","locked":"0x00000000000000000006a989fe295800","unlock_height":2675,"nonce":18}`,
        '/v2/contracts/call-read/ST000000000000000000002AMW42H/pox-2/get-stacker-info': `{"okay":true,"result":"${mockedResult}"}`,
      });

      const stackingStatus = await client.getStatus();
      if (!stackingStatus.stacked) throw Error;

      expect(stackingStatus.details.pox_address.hashbytes).toEqual(hexToBytes(expectedHash));
      expect(stackingStatus.details.pox_address.version).toHaveLength(1);
      expect(stackingStatus.details.pox_address.version[0]).toEqual(expectedVersion);
    }
  );
});
