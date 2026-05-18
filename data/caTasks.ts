
export interface CATask {
  id: string;
  tierId: string;
  monster: string;
  description: string;
}

export const ALL_CA_TASKS: CATask[] = [
  // ============================================================================
  // EASY TIER
  // ============================================================================
  // --- WINTERTODT ---
  { id: 'ca_easy_1', tierId: 'Easy', monster: 'Wintertodt', description: 'Kill the Wintertodt.' },
  { id: 'ca_easy_2', tierId: 'Easy', monster: 'Wintertodt', description: 'Subdue Wintertodt without taking damage from the cold (Warm clothing).' },
  { id: 'ca_easy_3', tierId: 'Easy', monster: 'Wintertodt', description: 'Subdue Wintertodt with at least 500 points.' },
  { id: 'ca_easy_4', tierId: 'Easy', monster: 'Wintertodt', description: 'Heal a Pyromancer.' },
  // --- TEMPOROSS ---
  { id: 'ca_easy_5', tierId: 'Easy', monster: 'Tempoross', description: 'Subdue Tempoross.' },
  { id: 'ca_easy_6', tierId: 'Easy', monster: 'Tempoross', description: 'Subdue Tempoross without losing any masts/totems.' },
  { id: 'ca_easy_7', tierId: 'Easy', monster: 'Tempoross', description: 'Feed Tempoross some cooked fish.' },
  // --- KING BLACK DRAGON ---
  { id: 'ca_easy_8', tierId: 'Easy', monster: 'King Black Dragon', description: 'Kill the King Black Dragon.' },
  { id: 'ca_easy_9', tierId: 'Easy', monster: 'King Black Dragon', description: 'Kill the KBD while equipping an anti-dragon shield.' },
  // --- GIANT MOLE ---
  { id: 'ca_easy_10', tierId: 'Easy', monster: 'Giant Mole', description: 'Kill the Giant Mole.' },
  { id: 'ca_easy_11', tierId: 'Easy', monster: 'Giant Mole', description: 'Kill the Giant Mole 10 times.' },
  // --- OBOR ---
  { id: 'ca_easy_12', tierId: 'Easy', monster: 'Obor', description: 'Kill Obor.' },
  { id: 'ca_easy_13', tierId: 'Easy', monster: 'Obor', description: 'Kill Obor without taking any damage off prayer (use Protect Melee).' },
  { id: 'ca_easy_14', tierId: 'Easy', monster: 'Obor', description: 'Kill Obor while he is immobilized (Snare/Bind).' },
  // --- BRYOPHYTA ---
  { id: 'ca_easy_15', tierId: 'Easy', monster: 'Bryophyta', description: 'Kill Bryophyta.' },
  { id: 'ca_easy_16', tierId: 'Easy', monster: 'Bryophyta', description: 'Kill Bryophyta with poison damage.' },
  { id: 'ca_easy_17', tierId: 'Easy', monster: 'Bryophyta', description: 'Kill Bryophyta without using protection prayers.' },
  // --- SARACHNIS ---
  { id: 'ca_easy_18', tierId: 'Easy', monster: 'Sarachnis', description: 'Kill Sarachnis.' },
  { id: 'ca_easy_19', tierId: 'Easy', monster: 'Sarachnis', description: 'Kill Sarachnis 10 times.' },
  // --- DERANGED ARCHAEOLOGIST ---
  { id: 'ca_easy_20', tierId: 'Easy', monster: 'Deranged Archaeologist', description: 'Kill the Deranged Archaeologist.' },
  { id: 'ca_easy_21', tierId: 'Easy', monster: 'Deranged Archaeologist', description: 'Kill him without taking damage from his special attack.' },
  // --- SCURRIUS ---
  { id: 'ca_easy_22', tierId: 'Easy', monster: 'Scurrius', description: 'Kill Scurrius.' },
  { id: 'ca_easy_23', tierId: 'Easy', monster: 'Scurrius', description: 'Kill Scurrius in a private instance.' },
  { id: 'ca_easy_24', tierId: 'Easy', monster: 'Scurrius', description: 'Avoid all falling masonry during the fight.' },
  // --- BARROWS ---
  { id: 'ca_easy_25', tierId: 'Easy', monster: 'Barrows', description: 'Loot a Barrows chest.' },
  { id: 'ca_easy_26', tierId: 'Easy', monster: 'Barrows', description: 'Kill all 6 brothers and loot the chest.' },
  { id: 'ca_easy_27', tierId: 'Easy', monster: 'Barrows', description: 'Kill a brother using only Magic.' },
  // --- GENERAL / SLAYER ---
  { id: 'ca_easy_28', tierId: 'Easy', monster: 'General', description: 'Equip a Slayer Helmet.' },
  { id: 'ca_easy_29', tierId: 'Easy', monster: 'General', description: 'Defeat a Superior Slayer Creature.' },
  { id: 'ca_easy_30', tierId: 'Easy', monster: 'General', description: 'Complete a Slayer Task.' },
  { id: 'ca_easy_31', tierId: 'Easy', monster: 'General', description: 'Kill a Lizardman Shaman.' },
  { id: 'ca_easy_32', tierId: 'Easy', monster: 'General', description: 'Defeat the Mimic.' },
  { id: 'ca_easy_33', tierId: 'Easy', monster: 'General', description: 'Equip a Fire Cape.' },

  // ============================================================================
  // MEDIUM TIER
  // ============================================================================
  // --- BARROWS ---
  { id: 'ca_med_1', tierId: 'Medium', monster: 'Barrows', description: 'Loot a Barrows chest without taking any melee damage from the brothers.' },
  { id: 'ca_med_2', tierId: 'Medium', monster: 'Barrows', description: 'Loot 25 Barrows chests.' },
  { id: 'ca_med_3', tierId: 'Medium', monster: 'Barrows', description: 'Kill Dharok while he is at low health.' },
  // --- BRYOPHYTA ---
  { id: 'ca_med_4', tierId: 'Medium', monster: 'Bryophyta', description: 'Kill Bryophyta 5 times.' },
  { id: 'ca_med_5', tierId: 'Medium', monster: 'Bryophyta', description: 'Kill 3 growthlings within 3 seconds of each other.' },
  // --- CHAOS FANATIC ---
  { id: 'ca_med_6', tierId: 'Medium', monster: 'Chaos Fanatic', description: 'Kill the Chaos Fanatic.' },
  { id: 'ca_med_7', tierId: 'Medium', monster: 'Chaos Fanatic', description: 'Kill the Chaos Fanatic 10 times.' },
  { id: 'ca_med_8', tierId: 'Medium', monster: 'Chaos Fanatic', description: 'Avoid all of his explosion attacks.' },
  // --- CRAZY ARCHAEOLOGIST ---
  { id: 'ca_med_9', tierId: 'Medium', monster: 'Crazy Archaeologist', description: 'Kill the Crazy Archaeologist.' },
  { id: 'ca_med_10', tierId: 'Medium', monster: 'Crazy Archaeologist', description: 'Kill the Crazy Archaeologist 10 times.' },
  { id: 'ca_med_11', tierId: 'Medium', monster: 'Crazy Archaeologist', description: 'Kill him without taking damage from Rain of Knowledge.' },
  // --- DAGANNOTH KINGS ---
  { id: 'ca_med_12', tierId: 'Medium', monster: 'Dagannoth Kings', description: 'Kill a Dagannoth King.' },
  { id: 'ca_med_13', tierId: 'Medium', monster: 'Dagannoth Kings', description: 'Kill a Dagannoth King while another one is alive.' },
  { id: 'ca_med_14', tierId: 'Medium', monster: 'Dagannoth Kings', description: 'Kill 10 Dagannoth Kings.' },
  // --- GIANT MOLE ---
  { id: 'ca_med_15', tierId: 'Medium', monster: 'Giant Mole', description: 'Kill the Giant Mole 25 times.' },
  { id: 'ca_med_16', tierId: 'Medium', monster: 'Giant Mole', description: 'Kill the Giant Mole while having at least 3 active Fally Shield charges remaining.' },
  // --- HESPORI ---
  { id: 'ca_med_17', tierId: 'Medium', monster: 'Hespori', description: 'Kill Hespori.' },
  { id: 'ca_med_18', tierId: 'Medium', monster: 'Hespori', description: 'Kill Hespori 5 times.' },
  { id: 'ca_med_19', tierId: 'Medium', monster: 'Hespori', description: 'Kill Hespori without taking damage from the entangling vines.' },
  // --- KING BLACK DRAGON ---
  { id: 'ca_med_20', tierId: 'Medium', monster: 'King Black Dragon', description: 'Kill the KBD 25 times.' },
  // --- OBOR ---
  { id: 'ca_med_21', tierId: 'Medium', monster: 'Obor', description: 'Kill Obor 5 times.' },
  // --- SARACHNIS ---
  { id: 'ca_med_22', tierId: 'Medium', monster: 'Sarachnis', description: 'Kill Sarachnis 25 times.' },
  { id: 'ca_med_23', tierId: 'Medium', monster: 'Sarachnis', description: 'Kill Sarachnis without her healing from you.' },
  // --- SCURRIUS ---
  { id: 'ca_med_24', tierId: 'Medium', monster: 'Scurrius', description: 'Kill Scurrius 25 times.' },
  { id: 'ca_med_25', tierId: 'Medium', monster: 'Scurrius', description: 'Kill Scurrius taking no damage.' },
  // --- SKOTIZO ---
  { id: 'ca_med_26', tierId: 'Medium', monster: 'Skotizo', description: 'Kill Skotizo.' },
  { id: 'ca_med_27', tierId: 'Medium', monster: 'Skotizo', description: 'Kill Skotizo without taking any damage from the Awakened Altars.' },
  // --- TEMPOROSS ---
  { id: 'ca_med_28', tierId: 'Medium', monster: 'Tempoross', description: 'Subdue Tempoross 25 times.' },
  { id: 'ca_med_29', tierId: 'Medium', monster: 'Tempoross', description: 'Subdue Tempoross with maximum possible reward points (solo).' },
  // --- WINTERTODT ---
  { id: 'ca_med_30', tierId: 'Medium', monster: 'Wintertodt', description: 'Subdue Wintertodt 25 times.' },
  { id: 'ca_med_31', tierId: 'Medium', monster: 'Wintertodt', description: 'Subdue Wintertodt taking no damage from the cold or braziers.' },
  // --- GENERAL ---
  { id: 'ca_med_32', tierId: 'Medium', monster: 'General', description: 'Complete 25 Slayer Tasks.' },
  { id: 'ca_med_33', tierId: 'Medium', monster: 'General', description: 'Defeat a Superior Slayer Creature 10 times.' },
  { id: 'ca_med_34', tierId: 'Medium', monster: 'General', description: 'Complete a Hard Clue Scroll.' },

  // ============================================================================
  // HARD TIER
  // ============================================================================
  // --- ZULRAH ---
  { id: 'ca_hard_1', tierId: 'Hard', monster: 'Zulrah', description: 'Kill Zulrah.' },
  { id: 'ca_hard_2', tierId: 'Hard', monster: 'Zulrah', description: 'Kill Zulrah without being hit by the melee attack.' },
  { id: 'ca_hard_3', tierId: 'Hard', monster: 'Zulrah', description: 'Kill Zulrah 25 times.' },
  // --- VORKATH ---
  { id: 'ca_hard_4', tierId: 'Hard', monster: 'Vorkath', description: 'Kill Vorkath.' },
  { id: 'ca_hard_5', tierId: 'Hard', monster: 'Vorkath', description: 'Kill Vorkath without getting hit by the firewall or acid pool.' },
  { id: 'ca_hard_6', tierId: 'Hard', monster: 'Vorkath', description: 'Kill Vorkath 25 times.' },
  // --- GROTESQUE GUARDIANS ---
  { id: 'ca_hard_7', tierId: 'Hard', monster: 'Grotesque Guardians', description: 'Kill the Grotesque Guardians.' },
  { id: 'ca_hard_8', tierId: 'Hard', monster: 'Grotesque Guardians', description: 'Kill them 25 times.' },
  { id: 'ca_hard_9', tierId: 'Hard', monster: 'Grotesque Guardians', description: 'Kill them without getting hit by Lightning.' },
  // --- GOD WARS ---
  { id: 'ca_hard_10', tierId: 'Hard', monster: 'General Graardor', description: 'Kill General Graardor.' },
  { id: 'ca_hard_11', tierId: 'Hard', monster: 'Commander Zilyana', description: 'Kill Commander Zilyana.' },
  { id: 'ca_hard_12', tierId: 'Hard', monster: 'K\'ril Tsutsaroth', description: 'Kill K\'ril Tsutsaroth.' },
  { id: 'ca_hard_13', tierId: 'Hard', monster: 'Kree\'arra', description: 'Kill Kree\'arra.' },
  // --- DAGANNOTH KINGS ---
  { id: 'ca_hard_14', tierId: 'Hard', monster: 'Dagannoth Kings', description: 'Kill all three Dagannoth Kings in a single trip.' },
  { id: 'ca_hard_15', tierId: 'Hard', monster: 'Dagannoth Kings', description: 'Kill 25 of each King.' },
  // --- BARROWS ---
  { id: 'ca_hard_16', tierId: 'Hard', monster: 'Barrows', description: 'Loot 100 Barrows Chests.' },
  { id: 'ca_hard_17', tierId: 'Hard', monster: 'Barrows', description: 'Kill all 6 brothers using only melee.' },
  // --- GIANT MOLE ---
  { id: 'ca_hard_18', tierId: 'Hard', monster: 'Giant Mole', description: 'Kill the Giant Mole 50 times.' },
  { id: 'ca_hard_19', tierId: 'Hard', monster: 'Giant Mole', description: 'Kill the Giant Mole in under 2 minutes.' },
  // --- KALPHITE QUEEN ---
  { id: 'ca_hard_20', tierId: 'Hard', monster: 'Kalphite Queen', description: 'Kill the Kalphite Queen.' },
  { id: 'ca_hard_21', tierId: 'Hard', monster: 'Kalphite Queen', description: 'Kill the Kalphite Queen 10 times.' },
  // --- PHANTOM MUSPAH ---
  { id: 'ca_hard_22', tierId: 'Hard', monster: 'Phantom Muspah', description: 'Kill the Phantom Muspah.' },
  { id: 'ca_hard_23', tierId: 'Hard', monster: 'Phantom Muspah', description: 'Kill the Phantom Muspah 25 times.' },
  // --- WILDERNESS BOSSES (Singles) ---
  { id: 'ca_hard_24', tierId: 'Hard', monster: 'Chaos Elemental', description: 'Kill the Chaos Elemental 10 times.' },
  { id: 'ca_hard_25', tierId: 'Hard', monster: 'Chaos Fanatic', description: 'Kill the Chaos Fanatic 25 times.' },
  { id: 'ca_hard_26', tierId: 'Hard', monster: 'Crazy Archaeologist', description: 'Kill the Crazy Archaeologist 25 times.' },
  { id: 'ca_hard_27', tierId: 'Hard', monster: 'Calvar\'ion', description: 'Kill Calvar\'ion 10 times.' },
  { id: 'ca_hard_28', tierId: 'Hard', monster: 'Spindel', description: 'Kill Spindel 10 times.' },
  { id: 'ca_hard_29', tierId: 'Hard', monster: 'Artio', description: 'Kill Artio 10 times.' },
  // --- GENERAL ---
  { id: 'ca_hard_30', tierId: 'Hard', monster: 'General', description: 'Complete the Fight Caves (Kill Jad).' },
  { id: 'ca_hard_31', tierId: 'Hard', monster: 'General', description: 'Complete a Hard Temple Trek.' },
  { id: 'ca_hard_32', tierId: 'Hard', monster: 'General', description: 'Kill 50 Superior Slayer Creatures.' },
  { id: 'ca_hard_33', tierId: 'Hard', monster: 'General', description: 'Complete 10 Elite Clue Scrolls.' },

  // ============================================================================
  // ELITE TIER
  // ============================================================================
  { id: 'ca_elite_1', tierId: 'Elite', monster: 'Vorkath', description: 'Kill Vorkath 50 times.' },
  { id: 'ca_elite_2', tierId: 'Elite', monster: 'Vorkath', description: 'Kill Vorkath 5 times without leaving the instance.' },
  { id: 'ca_elite_3', tierId: 'Elite', monster: 'Vorkath', description: 'Kill Vorkath in under 1:20.' },
  { id: 'ca_elite_4', tierId: 'Elite', monster: 'Zulrah', description: 'Kill Zulrah 50 times.' },
  { id: 'ca_elite_5', tierId: 'Elite', monster: 'Zulrah', description: 'Kill Zulrah in under 1:40.' },
  { id: 'ca_elite_6', tierId: 'Elite', monster: 'Abyssal Sire', description: 'Kill the Abyssal Sire.' },
  { id: 'ca_elite_7', tierId: 'Elite', monster: 'Abyssal Sire', description: 'Kill the Abyssal Sire without being hit by a tentacle.' },
  { id: 'ca_elite_8', tierId: 'Elite', monster: 'Alchemical Hydra', description: 'Kill the Alchemical Hydra.' },
  { id: 'ca_elite_9', tierId: 'Elite', monster: 'Alchemical Hydra', description: 'Kill the Hydra without taking damage from vents.' },
  { id: 'ca_elite_10', tierId: 'Elite', monster: 'Cerberus', description: 'Kill Cerberus.' },
  { id: 'ca_elite_11', tierId: 'Elite', monster: 'Cerberus', description: 'Kill Cerberus without taking damage from lava pools.' },
  { id: 'ca_elite_12', tierId: 'Elite', monster: 'Chambers of Xeric', description: 'Complete the Chambers of Xeric.' },
  { id: 'ca_elite_13', tierId: 'Elite', monster: 'Chambers of Xeric', description: 'Complete a deathless CoX raid.' },
  { id: 'ca_elite_14', tierId: 'Elite', monster: 'The Gauntlet', description: 'Complete the Corrupted Gauntlet.' },
  { id: 'ca_elite_15', tierId: 'Elite', monster: 'The Gauntlet', description: 'Complete the Gauntlet 5 times.' },
  { id: 'ca_elite_16', tierId: 'Elite', monster: 'The Nightmare', description: 'Kill the Nightmare.' },
  { id: 'ca_elite_17', tierId: 'Elite', monster: 'The Nightmare', description: 'Kill the Nightmare without anyone dying.' },
  { id: 'ca_elite_18', tierId: 'Elite', monster: 'Sarachnis', description: 'Kill Sarachnis 50 times.' },
  { id: 'ca_elite_19', tierId: 'Elite', monster: 'General Graardor', description: 'Kill General Graardor 50 times.' },
  { id: 'ca_elite_20', tierId: 'Elite', monster: 'Commander Zilyana', description: 'Kill Commander Zilyana 50 times.' },
  { id: 'ca_elite_21', tierId: 'Elite', monster: 'K\'ril Tsutsaroth', description: 'Kill K\'ril Tsutsaroth 50 times.' },
  { id: 'ca_elite_22', tierId: 'Elite', monster: 'Kree\'arra', description: 'Kill Kree\'arra 50 times.' },
  { id: 'ca_elite_23', tierId: 'Elite', monster: 'Muspah', description: 'Kill Phantom Muspah in under 2:30.' },
  { id: 'ca_elite_24', tierId: 'Elite', monster: 'General', description: 'Complete 25 Master Clue Scrolls.' },
  { id: 'ca_elite_25', tierId: 'Elite', monster: 'General', description: 'Reach Wave 63 in the Inferno.' },

  // ============================================================================
  // MASTER TIER
  // ============================================================================
  // --- INFERNO ---
  { id: 'ca_master_1', tierId: 'Master', monster: 'The Inferno', description: 'Defeat TzKal-Zuk (Complete the Inferno).' },
  // --- THEATRE OF BLOOD ---
  { id: 'ca_master_2', tierId: 'Master', monster: 'Theatre of Blood', description: 'Complete the Theatre of Blood (Normal Mode).' },
  { id: 'ca_master_3', tierId: 'Master', monster: 'Theatre of Blood', description: 'Complete a deathless ToB raid.' },
  { id: 'ca_master_4', tierId: 'Master', monster: 'Theatre of Blood', description: 'Complete ToB 25 times.' },
  // --- CHAMBERS OF XERIC ---
  { id: 'ca_master_5', tierId: 'Master', monster: 'Chambers of Xeric', description: 'Complete a Challenge Mode (CM) raid.' },
  { id: 'ca_master_6', tierId: 'Master', monster: 'Chambers of Xeric', description: 'Complete CoX 100 times.' },
  { id: 'ca_master_7', tierId: 'Master', monster: 'Chambers of Xeric', description: 'Complete CoX in under 18 minutes (Team) or 24 minutes (Solo).' },
  // --- TOMBS OF AMASCUT ---
  { id: 'ca_master_8', tierId: 'Master', monster: 'Tombs of Amascut', description: 'Complete an Expert Mode raid (Level 300+).' },
  { id: 'ca_master_9', tierId: 'Master', monster: 'Tombs of Amascut', description: 'Complete ToA 50 times.' },
  { id: 'ca_master_10', tierId: 'Master', monster: 'Tombs of Amascut', description: 'Complete a deathless Expert raid.' },
  // --- NEX ---
  { id: 'ca_master_11', tierId: 'Master', monster: 'Nex', description: 'Kill Nex.' },
  { id: 'ca_master_12', tierId: 'Master', monster: 'Nex', description: 'Kill Nex 50 times.' },
  { id: 'ca_master_13', tierId: 'Master', monster: 'Nex', description: 'MVP a Nex kill in a team of at least 2.' },
  // --- PHOSANI'S NIGHTMARE ---
  { id: 'ca_master_14', tierId: 'Master', monster: 'The Nightmare', description: 'Defeat Phosani\'s Nightmare.' },
  { id: 'ca_master_15', tierId: 'Master', monster: 'The Nightmare', description: 'Kill Phosani\'s Nightmare 25 times.' },
  { id: 'ca_master_16', tierId: 'Master', monster: 'The Nightmare', description: 'Kill Phosani\'s Nightmare in under 7:30.' },
  // --- CORRUPTED GAUNTLET ---
  { id: 'ca_master_17', tierId: 'Master', monster: 'The Gauntlet', description: 'Complete the Corrupted Gauntlet 50 times.' },
  { id: 'ca_master_18', tierId: 'Master', monster: 'The Gauntlet', description: 'Complete a Perfect Corrupted Hunllef.' },
  { id: 'ca_master_19', tierId: 'Master', monster: 'The Gauntlet', description: 'Complete the Corrupted Gauntlet in under 6:30.' },
  // --- ALCHEMICAL HYDRA ---
  { id: 'ca_master_20', tierId: 'Master', monster: 'Alchemical Hydra', description: 'Kill the Alchemical Hydra 100 times.' },
  { id: 'ca_master_21', tierId: 'Master', monster: 'Alchemical Hydra', description: 'Kill the Hydra in under 1:35.' },
  // --- VORKATH & ZULRAH (Speed) ---
  { id: 'ca_master_22', tierId: 'Master', monster: 'Vorkath', description: 'Kill Vorkath in under 1:10.' },
  { id: 'ca_master_23', tierId: 'Master', monster: 'Zulrah', description: 'Kill Zulrah in under 1:00.' },
  // --- DESERT TREASURE II BOSSES ---
  { id: 'ca_master_24', tierId: 'Master', monster: 'Vardorvis', description: 'Kill Vardorvis 50 times.' },
  { id: 'ca_master_25', tierId: 'Master', monster: 'The Leviathan', description: 'Kill the Leviathan 50 times.' },
  { id: 'ca_master_26', tierId: 'Master', monster: 'The Whisperer', description: 'Kill the Whisperer 50 times.' },
  { id: 'ca_master_27', tierId: 'Master', monster: 'Duke Sucellus', description: 'Kill Duke Sucellus 50 times.' },
  { id: 'ca_master_28', tierId: 'Master', monster: 'Vardorvis', description: 'Kill Awakened Vardorvis.' },
  { id: 'ca_master_29', tierId: 'Master', monster: 'The Leviathan', description: 'Kill Awakened Leviathan.' },
  { id: 'ca_master_30', tierId: 'Master', monster: 'The Whisperer', description: 'Kill Awakened Whisperer.' },
  { id: 'ca_master_31', tierId: 'Master', monster: 'Duke Sucellus', description: 'Kill Awakened Duke Sucellus.' },
  // --- GENERAL / OTHER BOSSES ---
  { id: 'ca_master_32', tierId: 'Master', monster: 'General', description: 'Kill all 6 Jad challenges (TzHaar-Ket-Rak).' },
  { id: 'ca_master_33', tierId: 'Master', monster: 'General', description: 'Kill the Corporeal Beast 50 times.' },
  { id: 'ca_master_34', tierId: 'Master', monster: 'General', description: 'Complete a Solo Corporeal Beast kill.' },
  { id: 'ca_master_35', tierId: 'Master', monster: 'General', description: 'Complete 50 Master Clue Scrolls.' },

  // ============================================================================
  // GRANDMASTER TIER
  // ============================================================================
  // --- INFERNO ---
  { id: 'ca_gm_1', tierId: 'Grandmaster', monster: 'The Inferno', description: 'Complete the Inferno in under 65 minutes.' },
  { id: 'ca_gm_2', tierId: 'Grandmaster', monster: 'The Inferno', description: 'Complete the Inferno without equipping any magic gear.' },
  { id: 'ca_gm_3', tierId: 'Grandmaster', monster: 'The Inferno', description: 'Complete the Inferno on a Slayer task.' },
  { id: 'ca_gm_4', tierId: 'Grandmaster', monster: 'The Inferno', description: 'Complete the Inferno 5 times.' },
  // --- THEATRE OF BLOOD ---
  { id: 'ca_gm_5', tierId: 'Grandmaster', monster: 'Theatre of Blood', description: 'Complete Hard Mode Theatre of Blood (HMT).' },
  { id: 'ca_gm_6', tierId: 'Grandmaster', monster: 'Theatre of Blood', description: 'Complete HMT in under 20:00 (Team).' },
  { id: 'ca_gm_7', tierId: 'Grandmaster', monster: 'Theatre of Blood', description: 'Complete a 5-man HMT raid without anyone dying.' },
  { id: 'ca_gm_8', tierId: 'Grandmaster', monster: 'Theatre of Blood', description: 'Kill Verzik (HMT) without anyone taking damage from bounce attack.' },
  // --- CHAMBERS OF XERIC ---
  { id: 'ca_gm_9', tierId: 'Grandmaster', monster: 'Chambers of Xeric', description: 'Complete a Solo CM raid in time.' },
  { id: 'ca_gm_10', tierId: 'Grandmaster', monster: 'Chambers of Xeric', description: 'Complete a Trio CM raid in under 30:00.' },
  { id: 'ca_gm_11', tierId: 'Grandmaster', monster: 'Chambers of Xeric', description: 'Complete a Solo CM without dying.' },
  // --- TOMBS OF AMASCUT ---
  { id: 'ca_gm_12', tierId: 'Grandmaster', monster: 'Tombs of Amascut', description: 'Complete a raid at 500+ Invocation.' },
  { id: 'ca_gm_13', tierId: 'Grandmaster', monster: 'Tombs of Amascut', description: 'Complete a 450+ raid in under 38 minutes (Solo).' },
  { id: 'ca_gm_14', tierId: 'Grandmaster', monster: 'Tombs of Amascut', description: 'Complete a Perfect Akkha at Expert level.' },
  { id: 'ca_gm_15', tierId: 'Grandmaster', monster: 'Tombs of Amascut', description: 'Complete a Perfect Wardens at Expert level.' },
  // --- NEX ---
  { id: 'ca_gm_16', tierId: 'Grandmaster', monster: 'Nex', description: 'Kill Nex in a duo.' },
  { id: 'ca_gm_17', tierId: 'Grandmaster', monster: 'Nex', description: 'Kill Nex without anyone taking damage from Blood Sacrifice.' },
  { id: 'ca_gm_18', tierId: 'Grandmaster', monster: 'Nex', description: 'Kill Nex without anyone taking damage from Ice Prison.' },
  // --- PHOSANI'S NIGHTMARE ---
  { id: 'ca_gm_19', tierId: 'Grandmaster', monster: 'The Nightmare', description: 'Kill Phosani\'s Nightmare in under 6:30.' },
  { id: 'ca_gm_20', tierId: 'Grandmaster', monster: 'The Nightmare', description: 'Kill Phosani\'s Nightmare 50 times.' },
  { id: 'ca_gm_21', tierId: 'Grandmaster', monster: 'The Nightmare', description: 'Perfect Phosani (No damage taken).' },
  // --- CORRUPTED GAUNTLET ---
  { id: 'ca_gm_22', tierId: 'Grandmaster', monster: 'The Gauntlet', description: 'Complete the Corrupted Gauntlet in under 6:00.' },
  { id: 'ca_gm_23', tierId: 'Grandmaster', monster: 'The Gauntlet', description: 'Complete the Corrupted Gauntlet without making armor.' },
  // --- OTHER BOSSES (Perfect/Speed) ---
  { id: 'ca_gm_24', tierId: 'Grandmaster', monster: 'Alchemical Hydra', description: 'Kill the Hydra in under 1:20.' },
  { id: 'ca_gm_25', tierId: 'Grandmaster', monster: 'Vorkath', description: 'Kill Vorkath in under 0:54.' },
  { id: 'ca_gm_26', tierId: 'Grandmaster', monster: 'Zulrah', description: 'Kill Zulrah in under 0:54.' },
  { id: 'ca_gm_27', tierId: 'Grandmaster', monster: 'Vardorvis', description: 'Kill Awakened Vardorvis perfectly.' },
  { id: 'ca_gm_28', tierId: 'Grandmaster', monster: 'The Leviathan', description: 'Kill Awakened Leviathan perfectly.' },
  { id: 'ca_gm_29', tierId: 'Grandmaster', monster: 'The Whisperer', description: 'Kill Awakened Whisperer perfectly.' },
  { id: 'ca_gm_30', tierId: 'Grandmaster', monster: 'Duke Sucellus', description: 'Kill Awakened Duke Sucellus perfectly.' },
  { id: 'ca_gm_31', tierId: 'Grandmaster', monster: 'General', description: 'Kill 6 Jads without taking damage.' }
];