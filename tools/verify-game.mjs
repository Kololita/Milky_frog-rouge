import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const checks=[
 'assembly_board','equipment_pickup','equipment_rolls','equipment_passives','combat_adjustments','player_hit_reactions','knockdown_escape','hit_grounding','reward_confirmation','energy_wind_immunity',
 'new_roster','stonekeeper_rig','monster_visual_effects','monster_effects','monster_architecture','advancing_attacks','authored_designs','enemy_models','elite_mechanics','balance_values','enemy_impact_params','arena_menu','enemy_specials','combat_refactor','dummy_recovery','enemy_steering','parry_throw_feedback','new_controls','throw_guard_boss','parry_spatial','samurai','boss_motion','boss_heavy',
 'attack_phases','attack_warnings','locked_controls','energy_absorption','pose_energy','break_laugh',
 'wave_occlusion','enemy_approach','home_art','settings','control_feel','developer_settings','pose_damage','absorb_buffer','throw_landing','equipment_energy_rage','skills','skill_effects','hitbox','hitbox_3d','prebattle_equipment','run_map','run_events','run_start','damage_types','buff_status','monsters','monster_groups','potions_rest','loot_equipment',
];
let failed=0;
for(const name of checks){
 const result=spawnSync(process.execPath,[fileURLToPath(new URL(`./verify_${name}.mjs`,import.meta.url))],{encoding:'utf8'});
 console.log(`${name}: ${result.status===0?'PASS':'FAIL'}`);
 if(result.status!==0){failed++;process.stderr.write(result.stderr||result.stdout||String(result.error));}
}
console.log(`${checks.length-failed}/${checks.length} current gameplay checks passed.`);
process.exitCode=failed?1:0;
