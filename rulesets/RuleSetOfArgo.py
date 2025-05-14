import random
from typing import List, Dict, Any, Callable
from rulesets.rule import Rule

class RuleSetOfArgo:
    def __init__(self):
        self.rules = []

    def add_rule(self, rule: Rule) -> None:
        self.rules.append(rule)

    def evaluate(self, context):
        for rule in self.rules:
            if rule.applies(context):
                rule.execute(context)

    def get_rules(self):
        return [{"name": rule.name, "description": rule.description} for rule in self.rules]

# D10 System Rule
def can_roll_d10(context):
    # Requires 'dice_pool' and 'difficulty' in context
    return "dice_pool" in context and "difficulty" in context

def d10_action(context):
    dice_pool = context["dice_pool"]
    difficulty = context["difficulty"]
    rolls = [random.randint(1, 10) for _ in range(dice_pool)]
    successes = sum(1 for roll in rolls if roll >= difficulty)
    print(f"Rolls: {rolls}")
    print(f"Successes (≥{difficulty}): {successes}")
    context["rolls"] = rolls
    context["successes"] = successes

d10_rule = Rule(
    name="D10Roll",
    description="Rolls a pool of d10 dice and counts successes.",
    condition=can_roll_d10,
    action=d10_action
)

# Example usage:
if __name__ == "__main__":
    # Example rule: If user is admin, print a message
    def is_admin(context):
        return context.get("user_role") == "admin"

    def admin_action(context):
        print("Admin access granted.")

    admin_rule = Rule(
        name="AdminAccess",
        description="Grants access if user is admin.",
        condition=is_admin,
        action=admin_action
    )

    ruleset = RuleSetOfArgo()
    ruleset.add_rule(admin_rule)
    ruleset.add_rule(d10_rule)

    # Simulate context for a d10 roll
    user_context = {
        "dice_pool": 5,      # Number of dice to roll
        "difficulty": 7      # Minimum value for a success
    }
    ruleset.evaluate(user_context)