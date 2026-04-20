# Análisis Lingüístico Colaborativo: De Keywords a LLM + Schema

## 1. Introducción

El módulo `interaction_analyzer.js` del Tutorbot implementa el análisis del contexto colaborativo del equipo de estudiantes. Este documento explica la evolución desde un enfoque basado en palabras clave (keywords) hacia un enfoque híbrido que utiliza el modelo de lenguaje con esquemas de salida estructurados.

**Estado actual**: ✅ Implementado (vía LLM con fallback keywords)

## 2. Implementación: Análisis Híbrido LLM + Schema

### 2.1 Flujo de Análisis

```
analyzeChatContext(message, openai)
    ├── 1. Obtener mensajes recientes (últimos 20)
    ├── 2. Intentar análisis vía LLM (llama-3.1-8b-instant)
    │   └── Con schema forzado → JSON válido → return
    └── 3. Si LLM falla (API error, timeout)
        └── Fallback keywords → return análisis
```

### 2.2 Parámetros de Configuración

| Parámetro | Valor | Notas |
|----------|-------|-------|
| Modelo | llama-3.1-8b-instant | Rápido y económico |
| Temperatura | 0.1 | Baja para coherencia |
| Timeout | 8s | antes de fallback |
| Mensajes a analizar | 10 | Optimizado |
| Max tokens | 500 | Suficiente para JSON |

### 2.3 Schema de Salida (implementado)

```json
{
  "type": "json_object",
  "schema": {
    "type": "object",
    "properties": {
      "conversationStage": {
        "type": "string",
        "enum": ["inicio", "desarrollo", "cierre"]
      },
      "groupState": {
        "type": "string", 
        "enum": ["blocked", "scattered", "superficial_consensus", "productive"]
      },
      "ideaQuality": {
        "type": "string",
        "enum": ["many_undecided", "few_well_justified", "balanced"]
      },
      "inactiveRoles": {
        "type": "array",
        "items": {"type": "string", "enum": ["coordinator", "secretary", "critic"]}
      },
      "scaffoldingLevel": {
        "type": "string",
        "enum": ["high", "medium", "light"]
      },
      "summary": {"type": "string"}
    },
    "required": ["conversationStage", "groupState", "ideaQuality", "inactiveRoles", "scaffoldingLevel"]
  }
}
```

### 2.4 Prompt del Sistema (implementado)

```system
Eres un analizador de contexto colaborativo para un sistema de aprendizaje cooperativo.

Tu tarea es analizar los mensajes recientes de un equipo de estudiantes y devolver un JSON con el análisis.

DEFINICIONES:
- Etapa: inicio (<10 msgs, discutiendo qué hacer), desarrollo (10-30 msgs, trabajando), cierre (>30 msgs, cerrando)
- Estado: blocked (sin avanzar), scattered (pocas voces), superficial_consensus (aceptan sin cuestionar), productive (bien)
- Calidad: many_undecided (sin decisiones), few_well_justified (decisiones sin rationale), balanced (adecuado)
- Roles inactivos: coordinador, secretario o crítico sin mensajes recientes
- Andamiaje: high (necesita guía fuerte), medium (sugerencias), light (ligero)

EJEMPLOS:
Input: "Hola, vamos a hacer el proyecto" | "Vale" | "De acuerdo" → {"conversationStage": "inicio", "groupState": "superficial_consensus", "ideaQuality": "many_undecided", "inactiveRoles": ["coordinator","secretary","critic"], "scaffoldingLevel": "medium"}
Input: "Hemos hecho el análisis" | "Bien" | "Ahora hacemos la presentación" | "Ok" → {"conversationStage": "desarrollo", "groupState": "productive", "ideaQuality": "balanced", "inactiveRoles": [], "scaffoldingLevel": "light"}

Responde SOLO con JSON válido, sin texto adicional.
```

## 3. Fallback: Análisis Keywords

### 3.1 Variables Analizadas (fallback)

| Variable | Método | Palabras Clave |
|----------|--------|---------------|
| Etapa de conversación | Conteo de mensajes | — |
| Estado del grupo | Regex | `hecho`, `listo`, `avanzad`, `terminad`, `complet`, `siguiente`, `paso`, `progreso` |
| Calidad de ideas | Regex | `decidimos`, `elegimos`, `votamos`, `acordamos`, `porque`, `ya que`, `justifica` |
| Preguntas | Regex | `?`, `cómo`, `qué`, `cuál`, `dónde`, `cuándo`, `por qué` |

### 3.2 Cuándo se Usa el Fallback

- Error de API (Groq no disponible)
- Timeout (LLM no responde en 8s)
- Respuesta inválida (no se puede parsear JSON)
- Cliente `openai` no proporcionado

## 4. Beneficios del Enfoque Híbrido

| Aspecto | Keywords | LLM + Schema |
|--------|----------|--------------|
| Comprensión semántica | ❌ | ✅ |
| Coherencia de salida | ✅ | ✅ (forzada por schema) |
| Flexibilidad contextual | ❌ | ✅ |
| Coste por análisis | Gratis (CPU) | Bajo (~50-100 tokens) |
| Latencia | Inmediata | ~1-2s |
| Resiliencia | ✅ | ✅ (fallback keywords) |
| Dependencia externa | No | Sí (API) |

## 5.Logging y Debug

El sistema registra en consola:

- `[ANALYZER] LLM análisis: {resultado}` - Análisis exitoso
- `[ANALYZER] LLM error, usando fallback keywords: {error}` - Fallback activado
- `[ANALYZER] Keyword fallback error: {error}` - Error en fallback

El resultado incluye `_llmSummary` cuando el análisis es por LLM para trazabilidad.

## 6. Comparativa Pedagógica

| Enfoque | Efecto Didáctico |
|---------|------------------|
| Keywords | El análisis es transparente pero limitado |
| LLM + Schema | El análisis captura matices pero "caja negra" |

**Decisión**: El enfoque híbrido mantiene la transparencia relativa (schema conocido) mientras mejora la calidad del análisis.

## 7. Referencias Técnicas

- Groq API: <https://console.groq.com/docs>
- OpenAI Response Format: <https://platform.openai.com/docs/guides/text-generation>
- JSON Schema: <https://json-schema.org/>