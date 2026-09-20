# Roteiro de leitor de tela — home-redesign (HOME-35)

**Status:** roteiro escrito · **execução pendente** (NVDA + Firefox/Chrome no Windows; VoiceOver + Safari no macOS/iOS).
Registrar em cada passo: ✅ / ❌ + o que foi anunciado.

## Preparação

- Produção (ou preview) com ≥ 5 resenhas publicadas, ao menos 2 com deficiência marcada e 1 sem.
- Rodar uma vez com a preferência de sistema "reduzir movimento" DESLIGADA e outra LIGADA.

## Passos

1. **Carregar `/`.** Esperado: título da página "OLDA — Observatório…"; nenhum anúncio contínuo enquanto a faixa se move (sem "Destaque n de N").
2. **Lista de landmarks** (NVDA `Insert+F7` / VO rotor "Pontos de referência"). Esperado: banner, navegação "Principal", principal, busca "Buscar resenhas", informações de conteúdo; UMA região "Em destaque"; uma região por fileira com o nome da deficiência.
3. **Lista de títulos** (`H`). Esperado: 1 nível 1 (Observatório…); nível 2 "Em destaque" e "Resenhas"; nível 3 por fileira; títulos dos cards abaixo. Anotar se a quantidade de headings de card atrapalha (A-8).
4. **Tab até "Pausar".** Esperado: "Pausar carrossel, botão". Ativar → "Retomar carrossel, botão"; a faixa para.
5. **Tab para dentro da faixa.** Esperado: cada card lido como link com o título, seguido da descrição (autor · ano, deficiência, trecho). O card focado fica inteiro visível e a faixa NÃO anda enquanto o foco está nela. As cópias do loop nunca recebem foco.
6. **Esc com foco num card.** Esperado: a sinopse some visualmente; nada muda no leitor; Tab adiante e voltar reabre.
7. **Fileira**: Tab até a região "Deficiência …" → anunciada como região; setas ← → do teclado rolam a lista. "Ver todos — Deficiência …" lido com o nome da fileira.
8. **Busca**: digitar um autor em "Buscar por título ou autor", Enter. Esperado: página recarrega; faixa ausente; "Resultados" (nível 3); contagem "Resenhas · N" lida.
9. **"Mais filtros"**: anunciado como botão recolhido/expandido; os três selects dentro dele rotulados.
10. **Busca sem resultado**: "Nenhuma resenha encontrada" + ações de recuperação.
11. **Reduzir movimento LIGADO**: faixa parada, sem botão Pausar; setas presentes.
12. **VoiceOver iOS (toque)**: tocar num card navega para a resenha; rolagem horizontal por gesto de três dedos nas fileiras.

## Resultado

| Passo | NVDA | VoiceOver | Observações |
|---|---|---|---|
| 1–12 | pendente | pendente | |
