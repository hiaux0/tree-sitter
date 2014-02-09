#include "follow_sets.h"
#include "first_set.h"
#include "rule_transitions.h"
#include "grammar.h"

using std::unordered_map;
using std::set;
using std::dynamic_pointer_cast;
using tree_sitter::rules::Symbol;

namespace tree_sitter {
    class Grammar;
    
    namespace build_tables {
        unordered_map<Symbol, set<Symbol>> follow_sets(const ParseItem &item, const Grammar &grammar) {
            unordered_map<Symbol, set<Symbol>> result;

            for (auto pair : sym_transitions(item.rule)) {
                auto symbol = *pair.first;
                if (grammar.has_definition(symbol)) {
                    auto following_non_terminals = first_set(pair.second, grammar);
                    if (rule_can_be_blank(pair.second)) {
                        following_non_terminals.insert(item.lookahead_sym);
                    }
                    result.insert({ symbol, following_non_terminals });
                }
            }
            
            return result;
        }
    }
}
