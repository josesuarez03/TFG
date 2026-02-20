# Expert Rules Schema

Los casos se cargan automáticamente desde `rules/cases/*.json|*.yaml`.

Campos mínimos por caso:
- `case_id`
- `intent_keywords`
- `required_fields`
- `tree` (nodos con `id`, `field`, `question`)
- `advice` (`Leve`, `Moderado`, `Severo`)

## Extracción declarativa opcional

Puedes definir `field_extractors` para capturar datos sin tocar código.

Tipos soportados:
- `pain_scale`: infiere valor 0-10.
- `categorical_keywords`: mapea categorías por keywords.
- `keyword_text`: guarda el mensaje completo si encuentra keywords.
- `regex`: extrae por regex (`patterns`, `group`, `value_type`).
- `always_text`: guarda siempre el mensaje completo.

Ejemplo:

```yaml
field_extractors:
  duration:
    type: keyword_text
    keywords: ["desde", "hace", "día", "semana"]
  pain_intensity:
    type: pain_scale
  onset:
    type: categorical_keywords
    categories:
      sudden: ["de repente", "súbito", "repentino"]
      gradual: ["gradual", "poco a poco"]
```

Si no defines extractor, el sistema:
- usa heurísticas por nombre de campo para campos comunes;
- y en flujo conversacional asigna la respuesta al `field` de la última pregunta (`active_node_id`).

## Emergencias

`rules/shared/emergency.json|yaml` admite:
- `global_red_flags`
- `psychological_crisis_flags`
- `case_red_flags`
- `psychological_case_ids` (casos que deben usar mensaje psicológico en escalado)
