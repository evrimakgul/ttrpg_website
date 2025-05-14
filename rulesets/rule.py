from typing import Dict, Any, Callable

class Rule:
    def __init__(self, name: str, description: str, condition: Callable[[Dict[str, Any]], bool], action: Callable[[Dict[str, Any]], None]):
        self.name = name
        self.description = description
        self.condition = condition
        self.action = action

    def applies(self, context: Dict[str, Any]) -> bool:
        return self.condition(context)

    def execute(self, context: Dict[str, Any]) -> None:
        self.action(context)