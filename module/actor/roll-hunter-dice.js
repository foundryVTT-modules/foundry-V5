/* global ChatMessage, Roll, game */

// Import dice face-related variables for icon paths
import { hunterDiceLocation, normalDiceFaces, desperationDiceFaces } from '../dice/icons.js'

// Function to roll dice
// numDice = Number of dice the function will roll
// actor = Actor's data
// label = Text that appears at the head of the ChatMessage
// difficulty = The amount of successes required for a given roll
// desperationDice = Additional desperation dice for the roll
// subtractWillpower = Subtracts a point of willpower, always, if true
export async function rollHunterDice (numDice, actor, label = '', difficulty = 0, desperationDice = 0, subtractWillpower = false) {
  // Roll defining and evaluating

  // Send the roll to Foundry
  const roll = new Roll(numDice + 'dhcs>5 + ' + desperationDice + 'dscs>5', actor.system)
  await roll.evaluate({ async: true })

  // Variable defining
  let difficultyResult = '<span></span>'
  let success = 0
  let desperationSuccess = 0
  let critSuccess = 0
  let desperationCritSuccess = 0
  let fail = 0
  let desperationFail = 0
  let desperationCritFail = 0

  // Defines the normal diceroll results
  roll.terms[0].results.forEach((dice) => {
    if (dice.success) {
      if (dice.result === 10) {
        critSuccess++
      } else {
        success++
      }
    } else {
      fail++
    }
  })

  // Track number of desperation diceroll results
  roll.terms[2].results.forEach((dice) => {
    if (dice.success) {
      if (dice.result === 10) {
        desperationCritSuccess++
      } else {
        desperationSuccess++
      }
    } else {
      if (dice.result === 1) {
        desperationCritFail++
      } else {
        desperationFail++
      }
    }
  })

  // Success canculating
  let totalCritSuccess = 0
  totalCritSuccess = Math.floor((critSuccess + desperationCritSuccess) / 2)
  const totalSuccess = (totalCritSuccess * 2) + success + desperationSuccess + critSuccess + desperationCritSuccess
  let successRoll = false

  // Get the difficulty result
  if (difficulty !== 0) {
    successRoll = totalSuccess >= difficulty
    difficultyResult = `( <span class="danger">${game.i18n.localize('WOD5E.Fail')}</span> )`
    if (successRoll) {
      difficultyResult = `( <span class="success">${game.i18n.localize('WOD5E.Success')}</span> )`
    }
  }

  // Define the contents of the ChatMessage
  let chatMessage = `<p class="roll-label uppercase">${label}</p>`

  // Special critical/desperation failure messages
  if (totalCritSuccess && successRoll) {
    chatMessage = chatMessage + `<p class="roll-content result-critical">${game.i18n.localize('WOD5E.CriticalSuccess')}</p>`
  }
  if (desperationCritFail && successRoll && difficulty > 0) {
    chatMessage = chatMessage + `<p class="roll-content result-desperation">${game.i18n.localize('WOD5E.DesperationSuccess')}</p>`
  }
  if (desperationCritFail && !successRoll && difficulty > 0) {
    chatMessage = chatMessage + `<p class="roll-content result-desperation">${game.i18n.localize('WOD5E.DespairFailure')}</p>`
  }
  if (desperationCritFail && !successRoll && difficulty === 0) {
    chatMessage = chatMessage + `<p class="roll-content result-desperation result-possible">${game.i18n.localize('WOD5E.PossibleDesperationFailure')}</p>`
  }

  // Total number of successes
  chatMessage = chatMessage + `<p class="roll-label result-success">${game.i18n.localize('WOD5E.Successes')}: ${totalSuccess} ${difficultyResult}</p>`

  // Run through displaying the normal dice
  for (let i = 0, j = critSuccess; i < j; i++) {
    chatMessage = chatMessage + '<img src="' + hunterDiceLocation + normalDiceFaces.critical + '" alt="Normal Crit" class="roll-img hunter-dice rerollable" />'
  }
  for (let i = 0, j = success; i < j; i++) {
    chatMessage = chatMessage + '<img src="' + hunterDiceLocation + normalDiceFaces.success + '" alt="Normal Success" class="roll-img hunter-dice rerollable" />'
  }
  for (let i = 0, j = fail; i < j; i++) {
    chatMessage = chatMessage + '<img src="' + hunterDiceLocation + normalDiceFaces.failure + '" alt="Normal Fail" class="roll-img hunter-dice rerollable" />'
  }

  // Separator
  chatMessage = chatMessage + '<br>'

  // Run through displaying Desperation dice
  for (let i = 0, j = desperationCritSuccess; i < j; i++) {
    chatMessage = chatMessage + '<img src="' + hunterDiceLocation + desperationDiceFaces.critical + '" alt="Desperation Crit" class="roll-img desperation-dice" />'
  }
  for (let i = 0, j = desperationSuccess; i < j; i++) {
    chatMessage = chatMessage + '<img src="' + hunterDiceLocation + desperationDiceFaces.success + '" alt="Desperation Success" class="roll-img desperation-dice" />'
  }
  for (let i = 0, j = desperationCritFail; i < j; i++) {
    chatMessage = chatMessage + '<img src="' + hunterDiceLocation + desperationDiceFaces.criticalFailure + '" alt="Desperation Critical Fail" class="roll-img desperation-dice" />'
  }
  for (let i = 0, j = desperationFail; i < j; i++) {
    chatMessage = chatMessage + '<img src="' + hunterDiceLocation + desperationDiceFaces.failure + '" alt="Desperation Fail" class="roll-img desperation-dice" />'
  }

  // Post the message to the chat
  roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: chatMessage
  })

  // Automatically track willpower damage as a result of willpower rerolls
  if (subtractWillpower && game.settings.get('vtm5e', 'automatedWillpower')) {
    // Get the actor's willpower and define it for convenience
    const actorWillpower = actor.system.willpower
    const maxWillpower = actorWillpower.max
    const aggrWillpower = actorWillpower.aggravated
    const superWillpower = actorWillpower.superficial

    // If the willpower boxes are fully ticked with aggravated damage
    // then tell the chat and don't increase any values.
    if (aggrWillpower >= maxWillpower) {
      roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: game.i18n.localize('WOD5E.WillpowerFull')
      })
    } else {
      // If the superficial willpower ticket isn't completely full, then add a point
      if ((superWillpower + aggrWillpower) < maxWillpower) {
        // If there are still superficial willpower boxes to tick, add it here

        // Define the new number of superficial willpower damage
        const newWillpower = superWillpower + 1

        // Update the actor sheet
        actor.update({ 'system.willpower.superficial': newWillpower })
      } else {
        // If there aren't any superficial boxes left, add an aggravated one

        // Define the new number of aggravated willpower damage
        // Superficial damage needs to be subtracted by 1 each time
        // a point of aggravated is added
        const newSuperWillpower = superWillpower - 1
        const newAggrWillpower = aggrWillpower + 1

        // Update the actor sheet
        actor.update({ 'system.willpower.superficial': newSuperWillpower })
        actor.update({ 'system.willpower.aggravated': newAggrWillpower })
      }
    }
  }
}
