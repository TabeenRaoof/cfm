# DPIA screening record

**Draft, 8 October 2026 (D-059). Answers lawyer question 7 in `README.md` with our view, for the
reviewer to confirm.**

**Question:** does CFM's processing need a data protection impact assessment (Art. 35)?

**Processing screened:** reading customers' uploaded compliance documents — responsible-person
mandates and packaging registration certificates — first with our own rules, then with an AI
provider for fields the rules can't find; storing the results; and evaluating them against the
requirement catalog. The personal data is business contact details of people named in the
documents (responsible persons, signatories, suppliers' contacts).

## Against the nine EDPB criteria (WP248 rev.01)

| Criterion | Met? | Why |
|---|---|---|
| Evaluation or scoring, including profiling | No | The output is facts about a document, not about a person |
| Automated decisions with legal or similar effect | No | No decision is made about anyone; a person in the customer's organisation confirms anything uncertain |
| Systematic monitoring | No | |
| Sensitive or highly personal data | No | Business contact details. The partner agreement forbids special-category and criminal-offence data |
| Large scale | No | A handful of design partners; few named people per document |
| Matching or combining datasets | No | Each organisation's data stays separate (row-level security) |
| Vulnerable data subjects | No | Business contacts acting in a professional role |
| Innovative use of technology | **Yes** | AI reading of documents |
| Prevents people exercising a right or using a service | No | |

## Conclusion

One criterion met. WP248 suggests a DPIA where two or more are met, so in our view **a DPIA is
not required** for the processing as it stands. The UK ICO also asks for one where innovative
technology is combined with any other criterion — not the case here.

## Revisit when any of these happens

- A document type that routinely carries sensitive or highly personal data (e.g. test reports
  naming individuals' health or biometric data).
- Use at scale: many customers, or bulk uploads of supplier contact data.
- Any profiling, scoring or decision about a person.
- A new AI use beyond reading fields from a document, or a change of AI provider or region.
