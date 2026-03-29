export interface DamageResult {
  finalDamage: number;
  armorDamage: number;
  remainingHealth: number;
  remainingArmor: number;
  killed: boolean;
}

export class DamageSystem {
  static calculateDamage(
    damage: number,
    targetHealth: number,
    targetArmor: number,
    isHeadshot: boolean = false
  ): DamageResult {
    let dmg = isHeadshot ? damage * 2.5 : damage;
    let armorDmg = 0;

    if (targetArmor > 0) {
      armorDmg = Math.min(targetArmor, dmg * 0.5);
      dmg -= armorDmg;
    }

    const remainingHealth = Math.max(0, targetHealth - dmg);
    const remainingArmor = Math.max(0, targetArmor - armorDmg);

    return {
      finalDamage: dmg,
      armorDamage: armorDmg,
      remainingHealth,
      remainingArmor,
      killed: remainingHealth <= 0,
    };
  }
}
