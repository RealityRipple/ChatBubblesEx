const DEFAULT_COLORS = [
  '#FF4A80',
  '#FF7070',
  '#FA8E4B',
  '#FEE440',
  '#5FFF77',
  '#00F5D4',
  '#00BBF9',
  '#4371FB',
  '#9B5DE5',
  '#F670DD',
]

let FieldData = {}
const Widget = {
  width: 0,
  height: 0,
  cooldown: false,
  raidActive: false,
  raidTimer: null,
  userMessageCount: {},
  soundEffects: [],
  messageCount: 0,
  pronouns: {},
  pronounsCache: {},
  channel: {},
  service: '',
  followCache: {},
  followToken: '',
  giftCache: [],
  globalEmotes: {},
  zweEmotes: {},
  modEmotes: {},
  modEmotesU: {},
  emojis: {}
}

const PRONOUNS_API_BASE = 'https://pronouns.alejo.io/api'
const PRONOUNS_API = {
  user: username => `${PRONOUNS_API_BASE}/users/${username}`,
  pronouns: `${PRONOUNS_API_BASE}/pronouns`,
}

const DEC_API_BASE = 'https://decapi.me/twitch'
const DEC_API = {
  followedSeconds: username =>
    `${DEC_API_BASE}/followed/${Widget.channel.username}/${username}?token=${FieldData.followToken}&format=U`,
}

const GLOBAL_EMOTES = {
  ffz: {
    api: 'https://api2.frankerfacez.com/v1/set/global',
    transformer: response => {
      const { default_sets, sets } = response
      const emoteNames = []
      for (const set of default_sets) {
        const { emoticons } = sets[set]
        for (const emote of emoticons) {
          if (emote.modifier)
            continue
          emoteNames.push(emote.name)
        }
      }
      return emoteNames
    },
  },
  bttv: {
    api: 'https://api.betterttv.net/3/cached/emotes/global',
    transformer: response => {
      const emoteNames = []
      for (const emote of response)
      {
        if (emote.modifier)
          continue
        emoteNames.push(emote.code)
      }
      return emoteNames
    },
  },
  '7tv': {
    api: 'https://7tv.io/v3/emote-sets/global',
    transformer: response => {
      const emoteNames = []
      for (const emote of response.emotes)
      {
        if ((emote.data.flags & 0x100) === 0x100)
          continue
        emoteNames.push(emote.name)
      }
      return emoteNames
    },
  },
}

const ZWE_EMOTES = {
  bttv: {
    api: 'https://api.betterttv.net/3/cached/emotes/global',
    transformer: response => {
      const emoteNames = []
      const bttvZWE = [
       '567b5b520e984428652809b6', //SoSnowy
       '5849c9a4f52be01a7ee5f79d', //IceCold
       '58487cc6f52be01a7ee5f205', //SantaHat
       '5849c9c8f52be01a7ee5f79e', //TopHat
       '567b5dc00e984428652809bd', //ReinDeer
       '567b5c080e984428652809ba', //CandyCane
       '5e76d399d6581c3724c0f0b8', //cvMask
       '5e76d338d6581c3724c0f0b2'  //cvHazmat
      ]
      for (const emote of response)
      {
        if (emote.modifier)
          continue
        if (bttvZWE.includes(emote.id))
          emoteNames.push(emote.code)
      }
      return emoteNames
    },
  },
  '7tv': {
    api: 'https://7tv.io/v3/emote-sets/global',
    transformer: response => {
      const emoteNames = []
      for (const emote of response.emotes)
      {
        if ((emote.data.flags & 0x100) !== 0x100)
          continue
        emoteNames.push(emote.name)
      }
      return emoteNames
    },
  },
}

const MODIFIER_EMOTES = {
  ffz: {
    api: 'https://api2.frankerfacez.com/v1/set/global',
    transformer: response => {
      const { default_sets, sets, users } = response
      const emoteNames = []
      for (const set of default_sets) {
        const { emoticons } = sets[set]
        for (const emote of emoticons) {
          if (!emote.modifier)
            continue
          emoteNames.push(emote.name)
        }
      }
      return emoteNames
    },
  },
  bttv: {
    api: 'https://api.betterttv.net/3/cached/emotes/global',
    transformer: response => {
      const emoteNames = []
      for (const emote of response)
      {
        if (!emote.modifier)
          continue
        emoteNames.push(emote.code)
      }
      return emoteNames
    },
  },
}

const USER_MODIFIER_EMOTES = {
  ffz: {
    api: 'https://api2.frankerfacez.com/v1/set/global',
    transformer: response => {
      const { sets, users } = response
      const emoteNames = {}
      for (const set in users) {
        if (!users.hasOwnProperty(set))
          continue
        const { emoticons } = sets[set]
        for (const user of users[set]) {
          emoteNames[user] = []
          for (const emote of emoticons) {
            if (!emote.modifier)
              continue
            emoteNames[user].push(emote.name)
          }
        }
      }
      return emoteNames
    },
  },
}

const EMOJIS = {
  api: 'https://cdn.jsdelivr.net/gh/realityripple/emoji/list.min.json',
  transformer: response => {
    const unqSkip = ['00a9', '00ae', '2122', '24c2']
    const emojiData = {}
    const eURL = 'https://cdn.jsdelivr.net/gh/realityripple/emoji/%SET_ID%/%EMOJI_ID%.png'
    let set = FieldData.emojiFont
    if (!set)
      set = 'twemoji'
    for (const id in response) {
      if (!response.hasOwnProperty(id))
        continue
      if (response[id].hasOwnProperty('t')) {
        if (response[id].hasOwnProperty('s') && response[id].s === -1 && unqSkip.includes(id))
          continue
        const u = eURL.replaceAll('%SET_ID%', set).replaceAll('%EMOJI_ID%', response[id].t)
        emojiData[response[id].t] = u
        continue
      }
      const u = eURL.replaceAll('%SET_ID%', set).replaceAll('%EMOJI_ID%', id)
      emojiData[id] = u
    }
    return emojiData
  },
}

// ---------------------------
//    Widget Initialization
// ---------------------------

window.addEventListener('onWidgetLoad', async obj => {
  Widget.channel = obj.detail.channel
  loadFieldData(obj.detail.fieldData)
  loadGlobalEmotes()
  loadZWEEmotes()
  loadModEmotes()
  loadUserModEmotes()
  loadEmojis()

  const { isEditorMode } = await SE_API.getOverlayStatus()
  conditionalMainClass('editor', isEditorMode)

  conditionalMainClass('dark-mode', FieldData.darkMode)
  conditionalMainClass(
    'custom-message-colors',
    FieldData.useCustomMessageColors,
  )
  conditionalMainClass('custom-border-colors', FieldData.useCustomBorderColors)
  conditionalMainClass(
    'custom-pronouns-badge-colors',
    FieldData.pronounsBadgeCustomColors,
  )

  if (FieldData.pronounsMode !== 'off') {
    await getPronouns()
  }

  if (FieldData.previewMode && isEditorMode) sendTestMessage(5, 500)
})

function loadFieldData(data) {
  FieldData = data

  const specificUsersSoundGroups = Array(10)
    .fill('specificUsersSoundGroup')
    .map((text, i) => `${text}${i + 1}`)
  processFieldData(
    value => stringToArray(value),
    'ignoreUserList',
    'ignorePrefixList',
    'allowUserList',
    'allowedStrings',
    ...specificUsersSoundGroups,
  )

  processFieldData(
    value => value === 'true',
    'includeEveryone',
    'includeSubs',
    'includeVIPs',
    'includeMods',
    'ignoreFirst',
    'emoteOnly',
    'highlightOnly',
    'darkMode',
    'useCustomMessageColors',
    'useCustomBorderColors',
    'previewMode',
    'largeEmotes',
    'showBadges',
    'fixedWidth',
    'pronounsLowercase',
    'pronounsBadgeCustomColors',
    'eventFollow',
    'eventSub',
    'eventGiftSub',
    'includeFollowers',
    'ffzGlobal',
    'bttvGlobal',
    '7tvGlobal',
    'topEdge',
    'bottomEdge',
    'leftEdge',
    'rightEdge',
    'hideOutOfBounds',
  )

  processFieldData(value => (value ? value : 1), 'delay')

  processFieldData(value => (value ? parseInt(value, 10) : 0), 'eventRaid')

  const soundData = {}
  for (let i = 1; i <= 10; i++) {
    const group = FieldData[`soundGroup${i}`]
    const specificUsers = FieldData[`specificUsersSoundGroup${i}`]
    const isSpecific = specificUsers.length > 0
    // specific-index so multiple specifics don't override each other
    const userLevel = isSpecific
      ? `specific-${i}`
      : FieldData[`userLevelSoundGroup${i}`]
    const messageType = FieldData[`messageTypeSoundGroup${i}`]
    if (group && group.length > 0) {
      if (!soundData[userLevel]) {
        soundData[userLevel] = {}
      }

      if (isSpecific) {
        soundData[userLevel].users = specificUsers
      }

      if (!soundData[userLevel][messageType]) {
        soundData[userLevel][messageType] = []
      }

      soundData[userLevel][messageType].push(...group)
    }
  }

  Widget.soundEffects = Object.entries(soundData)
    .reduce((acc, entry) => {
      const [userLevel, { users, ...messageTypes }] = entry
      for (const [messageType, soundEffects] of Object.entries(messageTypes)) {
        acc.push({
          userLevel,
          messageType,
          soundEffects,
          users,
          order: soundSortOrder(userLevel, messageType),
        })
      }
      return [...acc]
    }, [])
    .sort(({ order: a }, { order: b }) => {
      // sort by userLevel (0) then by messageType (1)
      if (a[0] !== b[0]) return b[0] - a[0]
      else return b[1] - a[1]
    })
}

function processFieldData(process, ...keys) {
  for (const key of keys) {
    FieldData[key] = process(FieldData[key])
  }
}

function stringToArray(string = '', separator = ',') {
  return string.split(separator).reduce((acc, value) => {
    const trimmed = value.trim()
    if (trimmed !== '') acc.push(trimmed)
    return acc
  }, [])
}

function conditionalMainClass(className, condition = true) {
  const main = $('main')

  if (condition) main.addClass(className)
  else main.removeClass(className)
}

function soundSortOrder(userLevel, messageType) {
  return [userLevelSortOrder(userLevel), messageTypeSortOrder(messageType)]
}

function userLevelSortOrder(userLevel) {
  switch (userLevel) {
    case 'everyone':
      return 0
    case 'subs':
      return 100
    case 'vips':
      return 200
    case 'mods':
      return 300
    default:
      return 1000 // assume specific
  }
}

function messageTypeSortOrder(messageType) {
  switch (messageType) {
    case 'highlight':
      return 1000
    case 'action':
      return 500
    case 'default':
      return 100
    default:
      return 0 // assume all
  }
}

async function loadGlobalEmotes() {
  for (const [key, value] of Object.entries(GLOBAL_EMOTES)) {
    const { api, transformer } = value
    const response = await get(api)
    if (response != null) {
      Widget.globalEmotes[key] = transformer(response)
    }
  }
}

async function loadZWEEmotes() {
  for (const [key, value] of Object.entries(ZWE_EMOTES)) {
    const { api, transformer } = value
    const response = await get(api)
    if (response != null) {
      Widget.zweEmotes[key] = transformer(response)
    }
  }
}

async function loadModEmotes() {
  for (const [key, value] of Object.entries(MODIFIER_EMOTES)) {
    const { api, transformer } = value
    const response = await get(api)
    if (response != null) {
      Widget.modEmotes[key] = transformer(response)
    }
  }
}

async function loadUserModEmotes() {
  for (const [key, value] of Object.entries(USER_MODIFIER_EMOTES)) {
    const { api, transformer } = value
    const response = await get(api)
    if (response != null) {
      Widget.modEmotesU[key] = transformer(response)
    }
  }
}

async function loadEmojis() {
  const { api, transformer } = EMOJIS
  const response = await get(api)
  if (response != null) {
    Widget.emojis = transformer(response)
  }
}

// --------------------
//    Event Handlers
// --------------------

window.addEventListener('onEventReceived', obj => {
  const { listener, event } = obj.detail
  switch (listener) {
    case 'message':
      onMessage(event)
      break
    case 'raid-latest':
      onRaid(event)
      break
    case 'delete-message':
      deleteMessage(event.msgId)
      break
    case 'delete-messages':
      deleteMessages(event.userId)
      break
    case 'event':
      onEvent(event)
      break
    case 'event:test':
      onButton(event)
      break
    default:
      return
  }
})

// ---------------------
//    Event Functions
// ---------------------

async function onMessage(event, testMessage = false) {
  const { service } = event
  Widget.service = service
  const {
    // facebook
    attachment,
    // trovo
    content_data,
    messageId,
    content,
    // general
    badges = [],
    userId = '',
    nick: username = '',
    displayName = '',
  } = event.data

  let { emotes = [], text = '', msgId = '', displayColor: color } = event.data

  let pronouns = null
  const allPronounKeys = Object.keys(Widget.pronouns)
  if (FieldData.pronounsMode !== 'off' && allPronounKeys.length > 0) {
    if (testMessage) {
      const randomPronounKey =
        allPronounKeys[random(0, allPronounKeys.length - 1)]
      pronouns = Widget.pronouns[randomPronounKey]
    } else if (service === 'twitch') {
      pronouns = await getUserPronoun(username)
    }
  }

  if (pronouns && FieldData.pronounsLowercase) {
    pronouns = pronouns.toLowerCase()
  }

  // handle facebook
  if (service === 'facebook' && attachment && attachment.type === 'sticker') {
    const { url, target } = attachment
    text = 'sticker'
    emotes.push({
      type: 'sticker',
      name: text,
      id: target.id,
      gif: false,
      urls: {
        1: url,
        2: url,
        4: url,
      },
      start: 0,
      end: text.length,
    })
  }

  // handle trovo
  if (service === 'trovo') {
    // remove messages from before the widget was loaded... idk why trovo sends these
    if (!content_data) return

    msgId = messageId
    text = content
    color = undefined
  }

  // Filters
  if (FieldData.raidCooldown > 0 && !Widget.raidActive) return
  if (FieldData.raidCooldown < 0 && Widget.raidActive) return
  if (hasIgnoredPrefix(text)) return
  if (!passedMinMessageThreshold(userId)) return
  if (
    FieldData.allowUserList.length &&
    !userListIncludes(FieldData.allowUserList, displayName, username)
  )
    return
  if (userListIncludes(FieldData.ignoreUserList, displayName, username)) return

  const permittedUserLevel = await hasIncludedBadge(badges, username)
  if (!permittedUserLevel) return
  if (
    FieldData.allowedStrings.length &&
    !FieldData.allowedStrings.includes(text)
  )
    return

  if (FieldData.ignoreFirst && isFirstTimeChat(event.data)) return

  const messageType = getMessageType(event.data)
  if (FieldData.highlightOnly && messageType !== 'highlight') return

  for (let i = emotes.length - 1; i >= 0; i--) {
    if (emotes[i].type !== 'emoji')
      continue
    emotes.splice(i, 1)
  }
  const newEmotes = emojiFind(text)
  if (newEmotes.length > 0) {
    emotes.push(...newEmotes)
    emotes.sort((a, b) => a.start - b.start)
  }

  const parsedText = parse(htmlEncode(text), emotes, username)

  const emoteSize = calcEmoteSize(parsedText)
  if (FieldData.emoteOnly && emoteSize === 1) return

  if (FieldData.messageCooldown) {
    if (Widget.cooldown) {
      return
    } else {
      Widget.cooldown = true
      window.setTimeout(() => {
        Widget.cooldown = false
      }, FieldData.messageCooldown * 1000)
    }
  }

  const elementData = {
    parsedText,
    name: displayName,
    emoteSize,
    messageType,
    msgId,
    userId,
    color,
    badges,
    pronouns,
  }

  // Render Bubble
  if (FieldData.positionMode !== 'list') {
    $('main').append(BubbleComponent(elementData))
  } else {
    $('main').prepend(BubbleComponent(elementData))
  }
  const currentMessage = `.bubble[data-message-id="${msgId}"]`

  // Calcute Bubble Position
  window.setTimeout(_ => {
    const height = $(currentMessage).outerHeight()
    let maxWidth =
      FieldData.fixedWidth || FieldData.theme.includes('.css')
        ? FieldData.maxWidth
        : $(`${currentMessage} .message-wrapper`).width() + 1
    const minWidth = $(`${currentMessage} .username`).outerWidth()

    $(`${currentMessage} .message`).css({
      '--dynamicWidth': Math.max(minWidth, maxWidth),
    })

    if (FieldData.positionMode !== 'list') {
      // I'm not entirely sure why the + 30 is necessary,
      // but it makes the calculations work correctly
      let xMax = Math.max(minWidth, maxWidth) + 30

      if (FieldData.theme === 'animal-crossing') {
        xMax += 15 // due to margin-left 15 on .message
      }

      const { left, top, right, bottom } = calcPosition(xMax, height)

      window.setTimeout(_ => {
        $(currentMessage).css({ left, top, right, bottom })
      }, 300)
    }
  }, 300)

  // Get Sound
  let sound = null
  const soundUrls = getSound(username, displayName, badges, messageType)
  if (soundUrls) {
    sound = new Audio(soundUrls[random(0, soundUrls.length - 1)])
    sound.volume = parseInt(FieldData.volume) / 100
  }

  // Show Bubble and Play Sound
  window.setTimeout(_ => {
    Widget.messageCount++
    if (soundUrls) sound.play()
    $(currentMessage).addClass('animate')
    $(currentMessage).addClass(FieldData.animation)
    if (FieldData.positionMode === 'list')
      $(currentMessage).css({ position: 'relative' })

    const getOldest = () => {
      const oldestMsgId =
        FieldData.positionMode !== 'list'
          ? $('.bubble:not(.expired)').first().attr('data-message-id')
          : $('.bubble:not(.expired)').last().attr('data-message-id')
      return [`.bubble[data-message-id="${oldestMsgId}"]`, oldestMsgId]
    }

    const earlyDelete = (selector, id) => {
      $(selector).addClass('expired')
      $(selector).fadeOut(400, _ => deleteMessage(id))
    }

    // Max message handling
    if (
      FieldData.maxMessages > 0 &&
      Widget.messageCount > FieldData.maxMessages
    ) {
      const [selector, id] = getOldest()
      earlyDelete(selector, id)
    }

    if (FieldData.hideOutOfBounds && FieldData.positionMode === 'list') {
      let hideDelay = 0
      if (FieldData.animation === 'dynamic') {
        if (
          FieldData.listDirection === 'left' ||
          FieldData.listDirection === 'right'
        )
          hideDelay = 200
        if (
          FieldData.listDirection === 'top' ||
          FieldData.listDirection === 'bottom'
        )
          hideDelay = 1000
      }
      window.setTimeout(_ => {
        let tryDelete = true
        while (tryDelete) {
          const [selector, id] = getOldest()
          const { left, top } = $(selector).position()
          const height = $(selector).outerHeight()
          const width = $(selector).outerWidth()
          const widgetWidth = $('main').innerWidth()
          const widgetHeight = $('main').innerHeight()

          switch (FieldData.listDirection) {
            case 'bottom':
              if (top < FieldData.padding) earlyDelete(selector, id)
              else tryDelete = false
              break
            case 'top':
              if (top > widgetHeight - FieldData.padding - height)
                earlyDelete(selector, id)
              else tryDelete = false
              break
            case 'left':
              if (left > widgetWidth - FieldData.padding - width)
                earlyDelete(selector, id)
              else tryDelete = false
              break
            case 'right':
              if (left < FieldData.padding) earlyDelete(selector, id)
              else tryDelete = false
              break
            default: // nothing
          }
        }
      }, hideDelay)
    }

    if (FieldData.lifetime > 0) {
      window.setTimeout(_ => {
        deleteMessage(msgId)
      }, FieldData.lifetime * 1000)
    }
  }, FieldData.delay * 1000)
}

function onRaid(event) {
  if (FieldData.raidCooldown === 0) return
  if (event.amount < FieldData.raidMin) return

  // Reset timer if another raid happens during an active raid timer
  clearTimeout(Widget.raidTimer)

  Widget.raidActive = true
  Widget.raidTimer = window.setTimeout(() => {
    Widget.raidActive = false
  }, Math.abs(FieldData.raidCooldown) * 1000)
}

function deleteMessage(msgId) {
  const messages = $(`.bubble[data-message-id="${msgId}"]`)
  Widget.messageCount -= messages.length
  messages.remove()
}

function deleteMessages(userId) {
  // userId is undefined when clear chat is used
  // when userId is defined, that user has been banned or timed out
  let selector = '.bubble'

  if (userId) {
    selector = `.bubble[data-user-id="${userId}"]`
    Widget.messageCount -= $(selector).length
  } else {
    Widget.messageCount = 0
  }

  $(selector).remove()
}

function onEvent(event) {
  switch (event.type) {
    case 'follow':
      onEventFollow(event)
      break
    case 'subscriber':
      if (event.data.hasOwnProperty('sender'))
        onEventGiftSub(event)
      else
        onEventSub(event)
      break
    case 'communityGiftPurchase':
      onEventBulkGiftSub(event)
      break
    case 'raid':
      onEventRaid(event)
      break
  }
}

function onEventFollow(event) {
  if (!FieldData.eventFollow)
    return
  const evRet = {
    data: {
      userId: event.data.username,
      tags: {
       'msg-id': 'highlighted-message',
      },
      text: event.data.displayName + ' is now a follower!',
      displayName: 'New Follow',
      nick: event.data.username,
      msgId: event.activityId,
      badges: [],
    },
  }
  onMessage(evRet)
}

function onEventSub(event) {
  if (!FieldData.eventSub)
    return
  const evRet = {
    data: {
      userId: event.data.username,
      tags: {
       'msg-id': 'highlighted-message',
      },
      text: 'A user has subscribed!',
      displayName: 'Sub',
      nick: event.data.username,
      msgId: event.activityId,
      badges: [],
    },
  }
  let tier = ''
  if (event.data.tier === 2000)
    tier = ' at Tier 2'
  else if (event.data.tier === 3000)
    tier = ' at Tier 3'
  else if (event.data.tier === 'Prime')
    tier = ' with Prime'
  if (event.data.amount > 1) {
    evRet.data.text = event.data.displayName + ' has resubscribed' + tier + ' for ' + event.data.amount + ' months!'
    evRet.data.displayName = 'Resub'
  } else {
    evRet.data.text = event.data.displayName + ' has subscribed' + tier + '!'
    evRet.data.displayName = 'New Sub'
  }
  onMessage(evRet)
}

function onEventGiftSub(event) {
  if (!FieldData.eventGiftSub)
    return
  if (event.hasOwnProperty('activityGroup') && Widget.giftCache.includes(event.activityGroup))
    return
  const evRet = {
    data: {
      userId: event.data.sender,
      tags: {
       'msg-id': 'highlighted-message',
      },
      text: 'A user has gifted a sub!',
      displayName: 'Gift Sub',
      nick: event.data.sender,
      msgId: event.activityId,
      badges: [],
    },
  }
  if (event.data.hasOwnProperty('message') && event.data.message !== '') {
    evRet.data.text = event.data.message
    onMessage(evRet)
    return
  }
  let tier = ''
  if (event.data.tier === 2000)
    tier = ' Tier 2'
  else if (event.data.tier === 3000)
    tier = ' Tier 3'
  if (event.data.amount > 1)
    evRet.data.text = (event.data.sender || 'Anonymous') + ' gifted a' + tier + ' sub to ' + event.data.displayName + ' for ' + event.data.amount + ' months!'
  else
    evRet.data.text = (event.data.sender || 'Anonymous') + ' gifted a' + tier + ' sub to ' + event.data.displayName + '!'
  onMessage(evRet)
}

function onEventBulkGiftSub(event) {
  if (!FieldData.eventGiftSub)
    return
  Widget.giftCache.push(event.activityGroup)
  const evRet = {
    data: {
      userId: event.data.username,
      tags: {
       'msg-id': 'highlighted-message',
      },
      text: 'A user has gifted subs!',
      displayName: 'Gift Sub',
      nick: event.data.username,
      msgId: event.activityId,
      badges: [],
    },
  }
  let tier = ''
  if (event.data.tier === 2000)
    tier = ' Tier 2'
  else if (event.data.tier === 3000)
    tier = ' Tier 3'
  if (event.data.amount > 1)
    evRet.data.text = (event.data.displayName || 'Anonymous') + ' has gifted ' + event.data.amount + tier + ' subs!'
  else
    evRet.data.text = (event.data.displayName || 'Anonymous') + ' has gifted a' + tier + ' sub!'
  onMessage(evRet)
}

function onEventRaid(event) {
  if (!FieldData.eventRaid)
    return
  if (event.data.amount < FieldData.eventRaid)
    return
  const evRet = {
    data: {
      userId: event.data.username,
      tags: {
       'msg-id': 'highlighted-message',
      },
      text: event.data.displayName + ' is raiding!',
      displayName: 'Raid',
      nick: event.data.username,
      msgId: event.activityId,
      badges: [],
    },
  }
  if (event.data.amount > 1)
    evRet.data.text = event.data.displayName + ' is raiding with ' + event.data.amount + ' viewers!'
  onMessage(evRet)
}

function onButton(event) {
  const { listener, field, value } = event

  if (listener !== 'widget-button' || value !== 'chatbubbletest')
    return

  switch (field) {
    case 'testMessageButton':
      sendTestMessage()
      break
    default:
      return
  }
}

const TEST_USER_TYPES = [
  { name: 'User', badges: [] },
  {
    name: 'Moderator',
    badges: [
      {
        type: 'moderator',
        url: 'https://static-cdn.jtvnw.net/badges/v1/3267646d-33f0-4b17-b3df-f923a41db1d0/3',
      },
    ],
  },
  {
    name: 'VIP',
    badges: [
      {
        type: 'vip',
        url: 'https://static-cdn.jtvnw.net/badges/v1/b817aba4-fad8-49e2-b88a-7cc744dfa6ec/3',
      },
    ],
  },
]

function sendTestMessage(amount = 1, delay = 250) {
  for (let i = 0; i < amount; i++) {
    window.setTimeout(_ => {
      const number = numbered.stringify(random(1, 10))
      const userType = TEST_USER_TYPES[random(0, TEST_USER_TYPES.length - 1)]
      const name = `${userType.name}_${numbered.stringify(random(1, 10))}`
      const event = {
        data: {
          userId: name,
          tags: {},
          text: 'test',
          displayName: random(0, 1) ? name : name.toLowerCase(),
          nick: '',
          msgId: `${name}_${Date.now()}`,
          badges: userType.badges,
        },
      }

      const previewMessage = FieldData.previewMessage.trim()
      if (previewMessage !== '') {
        event.data.text = previewMessage
      } else {
        const [text, emotes] =
          TEST_MESSAGES[random(0, TEST_MESSAGES.length - 1)]
        event.data.text = text
        event.data.emotes = emotes
      }

      let messageType = 1
      switch (FieldData.previewType) {
        case 'random':
          messageType = random(1, 3)
          break
        case 'action':
          messageType = 2
          break
        case 'highlight':
          messageType = 3
          break
        default:
          messageType = 1
      }

      if (messageType === 2) {
        event.data.isAction = true
      } else if (messageType === 3) {
        event.data.tags['msg-id'] = 'highlighted-message'
      }
      onMessage(event, true)
    }, i * delay)
  }
}

// -------------------------
//    Component Functions
// -------------------------

function BubbleComponent(props) {
  const {
    parsedText,
    emoteSize,
    messageType,
    msgId,
    userId,
    color: userColor,
    badges,
    pronouns,
  } = props

  let { name } = props

  if (FieldData.pronounsMode === 'suffix' && pronouns) {
    name = `${name} (${pronouns})`
  }

  const color = userColor || generateColor(name)
  const tColor = tinycolor(color)
  const darkerColor = tinycolor
    .mix(
      FieldData.useCustomBorderColors ? FieldData.borderColor : color,
      'black',
      25,
    )
    .toString()

  // based on https://stackoverflow.com/a/69869976
  const isDark = tColor.getLuminance() < 0.4

  const parsedElements = []
  let stackMods = []
  for (let i = 0, l = parsedText.length; i < l; i++) {
    let { type, data } = parsedText[i]
    switch (type) {
      case 'emote':
        if (stackMods.length > 0) {
          parsedElements.push(setModifierBTTV(EmoteComponent(data), stackMods))
          stackMods = []
        } else
          parsedElements.push(EmoteComponent(data))
        break
      case 'zwe':
        if (i < 2)
          parsedElements.push(EmoteComponent(data))
        else if (parsedText[i - 1].type === 'text' &&
                 parsedText[i - 1].data === ' ' &&
                 (parsedText[i - 2].type === 'emote' ||
                  parsedText[i - 2].type === 'zwe' ||
                  parsedText[i - 2].type === 'modifier')) {
          parsedElements.pop()
          parsedElements.push(wrapZWE(parsedElements.pop(), data))
        }else
          parsedElements.push(EmoteComponent(data))
        break
      case 'modifier':
        if (parsedText[i].data.type === 'bttv') {
          if (i - 1 >= parsedText.length)
            parsedElements.push(EmoteComponent(data))
          else if (parsedText[i + 1].type === 'text' &&
                   parsedText[i + 1].data === ' ' &&
                   (parsedText[i + 2].type === 'emote' || parsedText[i + 2].type === 'zwe' || parsedText[i + 2].type === 'modifier')) {
            if (parsedElements.length > 0 & data.name === 'z!' && parsedElements[parsedElements.length - 1] === '<span class=\'text\'> </span>') {
              parsedElements.pop()
            }
            stackMods.push(data)
          } else {
            parsedElements.push(EmoteComponent(data))
          }
        } else if (parsedText[i].data.type === 'ffz') {
          if (i < 2)
            parsedElements.push(EmoteComponent(data))
          else if (parsedText[i - 1].type === 'text' &&
                   parsedText[i - 1].data === ' ' &&
                   (parsedText[i - 2].type === 'emote' || parsedText[i - 2].type === 'zwe' || parsedText[i - 2].type === 'modifier')) {
            parsedElements.pop()
            parsedElements.push(setModifierFFZ(parsedElements.pop(), data))
          } else {
            parsedElements.push(EmoteComponent(data))
          }
        }
        break
      case 'text':
      default:
        if (stackMods.length > 0 && data === ' ')
          continue
        parsedElements.push(TextComponent(data))
        break
    }
  }

  let containerClasses = [
    'bubble',
    `emote-${FieldData.largeEmotes ? emoteSize : 1}`,
  ]
  switch (messageType) {
    case 'highlight': {
      if (FieldData.highlightStyle === 'rainbow')
        containerClasses.push('highlight')
      break
    }
    case 'action': {
      if (FieldData.actionStyle === 'italics') containerClasses.push('action')
      break
    }
    default: // nothing
  }

  if (isDark && !FieldData.theme.includes('.css'))
    containerClasses.push('user-color-dark')

  let usernameChildren = []
  if (FieldData.showBadges) {
    usernameChildren = BadgesComponent(badges)
  }
  if (FieldData.pronounsMode === 'badge' && pronouns) {
    usernameChildren.push(PronounsBadgeComponent(pronouns))
  }
  usernameChildren.push(name)

  const usernameProps = {}
  if (!FieldData.useCustomBorderColors && !FieldData.theme.includes('.css')) {
    usernameProps.style = {
      color: isDark
        ? tinycolor.mix(color, 'white', 85).toString()
        : tinycolor.mix(color, 'black', 85).toString(),
    }
  }

  const usernameBoxProps = {}
  if (FieldData.theme.includes('.css')) {
    usernameChildren.push(SpacerComponent())
    usernameChildren.push(
      Component('div', {
        class: 'title-bar-controls',
        children: [
          Component('button', { 'aria-label': 'Minimize' }),
          Component('button', { 'aria-label': 'Maximize' }),
          Component('button', { 'aria-label': 'Close' }),
        ],
      }),
    )
    containerClasses.push('window')
    usernameBoxProps.class = 'title-bar'
  }

  const bubbleChildren = [
    UsernameBoxComponent(
      UsernameComponent(usernameChildren, usernameProps),
      usernameBoxProps,
    ),
    MessageComponent(MessageWrapperComponent(parsedElements)),
  ]

  if (FieldData.theme === 'default') {
    bubbleChildren.unshift(BackgroundComponent())
  }

  return Component('section', {
    class: containerClasses,
    style: { '--userColor': color, '--darkerColor': darkerColor },
    'data-message-id': msgId,
    'data-user-id': userId,
    children: bubbleChildren,
  })
}

function wrapZWE(htm, zwe) {
  if (htm.slice(0, 6) === '<span ')
    return htm.slice(0, -7) + ZWEComponent(zwe) + htm.slice(-7)
  return '<span class=\'emoteBox\'>' + htm + ZWEComponent(zwe) + '</span>'
}

function setModifierFFZ(htm, mod) {
  return '<span class=\'mod-' + mod.name + '\'>' + htm + '</span>'
}

function setModifierBTTV(htm, mods) {
  let m = []
  for (const mod of mods) {
    if (!m.includes('mod-bttv-' + mod.name.slice(0, -1)))
      m.push('mod-bttv-' + mod.name.slice(0, -1))
  }
  if (m.length < 1)
    return htm
  let r = ''
  for (let i = 0; i < m.length; i++) {
    r += '<span class=\'' + m[i] + '\'>'
  }
  r += htm
  for (let i = 0; i < m.length; i++) {
    r += '</span>'
  }
  return r
}

function BadgesComponent(badges) {
  return badges.map(badge =>
    Component('img', { class: 'badge', src: badge.url, alt: badge.type }),
  )
}

function TextComponent(text) {
  return Component('span', { class: 'text', children: text })
}

function EmoteComponent({ urls, name }) {
  let url = urls[4]
  if (!url) url = urls[2]
  if (!url) url = urls[1]
  return Component('img', { class: ['emote'], src: url, alt: name })
}

function ZWEComponent({ urls, name }) {
  let url = urls[4]
  if (!url) url = urls[2]
  if (!url) url = urls[1]
  return Component('img', { class: ['emote zwe'], src: url, alt: name })
}

const ClassComponent =
  (tag, className) =>
  (children, props = {}) => {
    const { class: classNames, ...rest } = props
    return Component(tag, {
      children,
      class: [joinIfArray(classNames), className],
      ...rest,
    })
  }
const BackgroundComponent = ClassComponent('div', 'bubble-background')
const UsernameBoxComponent = ClassComponent('div', 'username-box')
const UsernameComponent = ClassComponent('div', 'username')
const PronounsBadgeComponent = ClassComponent('span', 'pronouns-badge')
const MessageComponent = ClassComponent('div', 'message')
const MessageWrapperComponent = ClassComponent('span', 'message-wrapper')
const SpacerComponent = ClassComponent('span', 'spacer')

function Component(tag, props) {
  const { children, class: classes, style, ...rest } = props

  if (classes) rest.class = joinIfArray(classes, ' ')

  if (style)
    rest.style = Object.entries(style)
      .map(([key, value]) => `${key}: ${value}`)
      .join(';')

  const attributes = Object.entries(rest).reduce(
    (acc, [attr, value]) => `${acc} ${attr}='${value}'`,
    '',
  )
  return `<${tag}${attributes}>${
    children !== undefined ? joinIfArray(children) : ''
  }</${tag}>`
}

// ----------------------------
//    Pronouns API Functions
// ----------------------------
async function getPronouns() {
  const res = await get(PRONOUNS_API.pronouns)
  if (res) {
    res.forEach(pronoun => {
      Widget.pronouns[pronoun.name] = pronoun.display
    })
  }
}

async function getUserPronoun(username) {
  const lowercaseUsername = username.toLowerCase()
  let pronouns = Widget.pronounsCache[lowercaseUsername]

  if (!pronouns || pronouns.expire < Date.now()) {
    const res = await get(PRONOUNS_API.user(lowercaseUsername))
    const [newPronouns] = res
    Widget.pronounsCache[lowercaseUsername] = {
      ...newPronouns,
      expire: Date.now() + 1000 * 60 * 5, // 5 minutes in the future
    }
    pronouns = Widget.pronounsCache[lowercaseUsername]
  }

  if (!pronouns.pronoun_id) {
    return null
  }

  return Widget.pronouns[pronouns.pronoun_id]
}

// ---------------------
//    Helper Functions
// ---------------------
async function get(URL) {
  return await fetch(URL)
    .then(async res => {
      if (!res.ok) return null
      return res.json()
    })
    .catch(error => null)
}

async function getFollowDate(username) {
  let followData = Widget.followCache[username]

  if (!followData || followData.expire < Date.now()) {
    const data = await get(DEC_API.followedSeconds(username))
    const seconds = parseInt(data)
    if (isNaN(seconds)) return null

    date = new Date(seconds * 1000) // convert to milliseconds then date

    Widget.followCache[username] = {
      date,
      expire: Date.now() + 1000 * 60 * 60, // 1 hour in the future
    }
    followData = Widget.followCache[username]
  }

  return followData.date
}

async function followCheck(username) {
  if (
    Widget.service !== 'twitch' || // only works on twitch
    Widget.channel.username.toLowerCase() === username.toLowerCase() // is broadcaster
  ) {
    return true
  }

  const followDate = await getFollowDate(username)
  if (!followDate) return false

  // convert minFollowTime from days to milliseconds
  const minFollowTime = 1000 * 60 * 60 * 24 * FieldData.minFollowTime
  return Date.now() - followDate >= minFollowTime
}

function hasIgnoredPrefix(text) {
  for (const prefix of FieldData.ignorePrefixList) {
    if (text.startsWith(prefix)) return true
  }
  return false
}

function passedMinMessageThreshold(userId) {
  if (FieldData.minMessages === 0) return true

  // begin counting
  if (!Widget.userMessageCount[userId]) Widget.userMessageCount[userId] = 0
  Widget.userMessageCount[userId]++

  return Widget.userMessageCount[userId] > FieldData.minMessages
}

function userListIncludes(userList, ...names) {
  const lowercaseNames = names.map(name => name.toLowerCase())
  return userList.some(user => lowercaseNames.includes(user.toLowerCase()))
}

async function hasIncludedBadge(badges = [], username) {
  const codeBadges = [...badges]

  if (FieldData.includeEveryone) return true

  const includedBadges = ['broadcaster']

  if (FieldData.includeFollowers) {
    includedBadges.push('follower')
    const isFollower = await followCheck(username)
    if (isFollower) {
      codeBadges.push({ type: 'follower' })
    }
  }

  if (!codeBadges.length) return false

  if (FieldData.includeSubs) includedBadges.push('subscriber', 'founder')
  if (FieldData.includeVIPs) includedBadges.push('vip')
  if (FieldData.includeMods) includedBadges.push('moderator')

  return hasBadge(codeBadges, ...includedBadges)
}

function isMod(badges = []) {
  return hasBadge(badges, 'moderator', 'broadcaster')
}

function isVIP(badges = []) {
  return hasBadge(badges, 'vip', 'broadcaster')
}

function isSub(badges = []) {
  return hasBadge(badges, 'subscriber', 'founder', 'broadcaster')
}

function hasBadge(userBadges = [], ...badgeTypes) {
  return userBadges.some(({ type }) => badgeTypes.includes(type))
}

function getMessageType(data) {
  if (data.isAction) return 'action'
  if (data.tags && data.tags['msg-id'] === 'highlighted-message')
    return 'highlight'
  return 'default'
}

function isFirstTimeChat(data) {
  return !!data.tags && data.tags['first-msg'] === '1'
}

function getSound(nick, name, badges, messageType) {
  for (const soundGroup of Widget.soundEffects) {
    const {
      userLevel,
      messageType: soundMessageType,
      users = [],
      soundEffects,
    } = soundGroup
    if (soundMessageType === 'all' || soundMessageType === messageType) {
      switch (userLevel) {
        case 'everyone':
          return soundEffects
        case 'subs':
          if (isSub(badges)) return soundEffects
          break
        case 'vips':
          if (isVIP(badges)) return soundEffects
          break
        case 'mods':
          if (isMod(badges)) return soundEffects
          break
        // assume specific
        default:
          if (userListIncludes(users, nick, name)) return soundEffects
          break
      }
    }
  }
  return null
}

function parse(text, emotes, usr) {
  const filteredAll = emotes.filter(emote => {
    const { name, type } = emote

    if (type === 'emoji')
      return true

    if (
      (type === 'ffz' && FieldData.ffzGlobal) ||
      (type === 'bttv' && FieldData.bttvGlobal) ||
      (type === '7tv' && FieldData['7tvGlobal'])
    )
      return true

    const globalEmotes = Widget.globalEmotes[type]
    if (!globalEmotes) return true

    return !globalEmotes.includes(name)
  })

  const filteredEmotes = emotes.filter(emote => {
    const { name, type } = emote

    if (type === 'emoji')
      return false

    if (
      (type === 'ffz' && FieldData.ffzGlobal) ||
      (type === 'bttv' && FieldData.bttvGlobal) ||
      (type === '7tv' && FieldData['7tvGlobal'])
    )
      return true

    const globalEmotes = Widget.globalEmotes[type]
    if (!globalEmotes) return true

    return !globalEmotes.includes(name)
  })

  const filteredEmojis = emotes.filter(emote => (emote.type === 'emoji'))

  if ((!filteredEmotes || filteredEmotes.length === 0) && (!filteredEmojis || filteredEmojis.length === 0)) {
    return [{ type: 'text', data: text }]
  }

  const regex = createRegex(filteredEmotes.map(e => htmlEncode(e.name)), filteredEmojis.map(e => e.name))

  const textObjs = text
    .split(regex)
    .map(string => ({ type: 'text', data: string }))
  const last = textObjs.pop()

  const parsedText = textObjs.reduce((acc, textObj, index) => {
    const emoteData = filteredAll[index]
    let eT = 'emote'
    
    const zweEmotes = Widget.zweEmotes[emoteData.type]
    if (!!zweEmotes && zweEmotes.includes(emoteData.name))
     eT = 'zwe'
    
    const modEmotes = Widget.modEmotes[emoteData.type]
    if (!!modEmotes && modEmotes.includes(emoteData.name))
     eT = 'modifier'
    
    const modEmotesU = Widget.modEmotesU[emoteData.type]
    if (!!modEmotesU && modEmotesU.hasOwnProperty(usr) && modEmotesU[usr].includes(emoteData.name))
     eT = 'modifier'
    
    return [...acc, textObj, { type: eT, data: emoteData }]
  }, [])

  parsedText.push(last)
  return parsedText
}

function calcEmoteSize(parsedText) {
  let emotesFound = 0
  for (const { type, data } of parsedText) {
    if (type === 'emote') {
      emotesFound++
    } else if (type === 'zwe' || type === 'modifier') {
      continue
    } else if (data.trim() !== '') return 1
  }
  if (emotesFound > 1) return 2
  return 4
}


const emojiFind = function() {
  const _sus = '0d9e'
  const crewSVG = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000"><style type="text/css">') + '%CSS%' + encodeURIComponent('</style><ellipse cx="533.9" cy="929.8" rx="295.8" ry="39.4" class="st0"/><path d="M812 403c25-28 39-63 36-98-3-41-29-80-72-111l-16-11a193 193 0 0 0-77-105c-34-21-70-31-102-39-18-5-33-4-46-3h-24c-37-5-74 3-108 24-31 19-58 47-76 79-25 44-35 93-41 140l-25 1c-27 0-60 0-84 26-20 23-21 53-22 73-3 73-5 150-3 225 1 44 6 89 39 120 26 24 59 30 89 30l10-1 6 60c4 25 8 49 21 71a113 113 0 0 0 116 51c46-8 84-45 94-90 5-22 3-43 2-62l-1-24h33c-8 44 7 91 40 120a115 115 0 0 0 87 27c31-3 57-17 75-39 19-24 26-54 31-82 21-126 28-254 18-382z"/><path d="m760 495-1-52c-20 10-44 18-72 24-26 6-50 9-73 9a184 184 0 0 1-179-123c-14-42-12-91 7-133 20-45 69-58 99-66 46-13 94-13 140-3-9-10-19-20-29-25-26-17-57-26-85-33-9-2-17-1-28-1-11 1-22 2-37 0-53-8-103 33-126 75l-4 6c-25 50-31 109-35 165-9 156-4 313 15 468 3 19 5 37 13 50 11 18 36 28 58 24 23-4 44-24 49-47 4-14 2-29 1-46-1-19-3-40 2-62 3-12 13-21 26-22h2c23 0 135-1 190-5 0 0-28 52-74 59-9 28-2 62 19 80 11 10 28 15 45 13 15-1 28-8 36-18 11-14 15-34 19-56 16-93 24-187 22-281zm-482-99 3-60h-20c-22 0-36 1-43 8-6 8-7 25-7 37l-1 18c-2 68-4 137-3 204 1 32 5 63 22 80 14 12 34 15 56 15-8-101-10-201-7-302z" class="st1"/><path d="M792 322c-3 20-15 40-33 55-20 16-47 27-84 36-42 9-75 10-103 2-38-12-70-42-83-80-11-29-9-63 4-92l6-9c7-8 21-17 57-26a230 230 0 0 1 188 32c39 28 47 55 48 69v13z" class="st2"/><path d="M285 698c-22 0-42-3-56-15-17-17-21-48-21-80-2-67 0-136 2-204 20-8 45-7 68-3-3 101-1 201 7 302zm475-203c-15 58-56 109-111 133-73 32-165 11-215-49-32-39-45-90-54-140-15-87-18-177-8-266-25 50-31 109-35 165-9 156-4 313 15 468 3 19 5 37 13 50 11 18 36 28 58 24 23-4 44-24 49-47 4-14 2-29 1-46-1-19-3-40 2-62 3-12 13-21 26-22h2c23 0 135-1 190-5 0 0-28 52-74 59-9 28-2 62 19 80 11 10 28 15 45 13 15-1 28-8 36-18 11-14 15-34 19-56 16-93 24-187 22-281z" class="st3"/><path d="M792 322c-3 20-15 40-33 55-20 16-47 27-84 36-42 9-75 10-103 2-38-12-70-42-83-80-11-29-9-63 4-92l6-9c7 11 13 40 18 49 10 17 26 33 44 44 38 23 84 28 128 22 35-4 69-15 103-27z" class="st4"/><path d="M614 274c-7-3-13-9-13-17-1-11 11-18 21-22 30-10 63-8 91 3 9 4 17 9 18 18 1 10-9 18-19 19s-20-3-29-4c-23-4-45 11-69 3z" class="st5"/></svg>')
  const crewColors = [['C51111', '300060'], ['132FD2', '00004A'], ['10802D', '021B2E'], ['ED53B9', '6B05A1'], ['EF7D0E', '730020'], ['F5F558', '8E1800'], ['3F484E', '000000'], ['D5E0EF', '2E4A8D'], ['6B30BC', '0E003C'], ['72491E', '4A040A'], ['39FEDB', '1054A1'], ['50EF3A', '006144'], ['938877', '14000A'], ['E27060', '983262'], ['F5E4A5', 'B89268'], ['F1C6D0', 'DA749C'], ['738593', '162638'], ['761E1C', '4A102C']]

  function $c_emoji(msg) {
    const emSeg = /((?:[\p{EPres}\p{ExtPict}]\ufe0f?\u200d?)+)+/gu
    const emList = []
    let match = ''
    while ((match = emSeg.exec(msg)) !== null) {
      emList.push(match)
    }
    const kcSeg = /((?:[0-9#\*]\ufe0f?\u20e3)+)+/gu
    match = ''
    while ((match = kcSeg.exec(msg)) !== null) {
      emList.push(match)
    }
    const acSeg = /(\u0d9e)/gu
    match = ''
    while ((match = acSeg.exec(msg)) !== null) {
      emList.push(match)
    }
    if (emList.length === 0)
      return []
    const rets = []
    for (let i = 0, l = emList.length; i < l; i++) {
      rets.push(..._parseEm(emList[i]))
    }
    return rets
  }

  function _parseEm(emI) {
    const ret = []
    const cpList = []
    for (const c of emI[0]) {
      const p = c.codePointAt(0).toString(16).padStart(4, '0')
      if (cpList.length === 0) {
        cpList.push(p)
        continue
      }
      const lL = cpList.length - 1
      if (p === 'fe0f')
        cpList[lL] += '-' + p
      else if (p === '200d')
        cpList[lL] += '-' + p
      else if (p === '20e3')
        cpList[lL] += '-' + p
      else if (p.match(/1f3f[b-f]/))
        cpList[lL] += '-' + p
      else if (p.match(/1f9b[0-3]/)) {
       if (cpList[lL].slice(-5) === '-200d')
         cpList[lL] += '-' + p
       else
         cpList[lL] += '-200d-' + p
      }
      else if (p.match(/264[0|2]/) || p.match(/26a7/)) {
        if (cpList[lL].slice(-5) === '-200d')
          cpList[lL] += '-' + p
        else
          cpList[lL] += '-200d-' + p
      }
      else if (p.match(/1f1((e[6-9a-f])|(f[0-9a-f]))/) && cpList[lL].match(/1f1((e[6-9a-f])|(f[0-9a-f]))/) && cpList[lL].length < 11)
        cpList[lL] += '-' + p
      else if (p === '1f308' && cpList[lL] === '1f3f3-fe0f')
        cpList[lL] += '-200d-' + p
      else if (p === '2620' && cpList[lL] === '1f3f4')
        cpList[lL] += '-200d-' + p
      else if (cpList[lL].slice(-5) === '-200d')
        cpList[lL] += '-' + p
      else
        cpList.push(p)
    }
    let pos = emI.index
    for (let j = 0, lP = cpList.length; j < lP; j++) {
      let s = cpList[j]
      let len = 1 + s.replaceAll(/[^\-]/g, '').length
      if (s === _sus) {
        const svgC = Math.floor(Math.random() * 18)
        const svgCSS = '.st0{fill:#484C4D;}.st1{fill:#' + crewColors[svgC][0] + ';}.st2{fill:#A3D3E3;}.st3{opacity:0.5;fill:#' + crewColors[svgC][1] + ';}.st4{opacity:0.45;fill:#5B7882;}.st5{fill:#FFFFFF;}' + (Math.random() < 0.5 ? 'svg{transform: scaleX(-1);}' : '')
        const crew = crewSVG.replace('%CSS%', encodeURIComponent(svgCSS))
        ret.push({name: _chrStr(s), id: s, urls: {1: crew, 2: crew, 4: crew}, type: 'emoji', gif: false, start: pos, end: pos + len})
        pos += len
        continue
      }
      if (Widget.emojis.hasOwnProperty(s))
        ret.push({name: _chrStr(s), id: s, urls: {1: Widget.emojis[s], 2: Widget.emojis[s], 4: Widget.emojis[s]}, type: 'emoji', gif: false, start: pos, end: pos + len})
      pos += len
    }
    return ret
  }

  function _chrStr(s) {
    let r = ''
    const x = s.split('-')
    for (let i = 0, l = x.length; i < l; i++) {
      r += String.fromCodePoint(parseInt(x[i], 16))
    }
    return r
  }

  return $c_emoji
}()


// I have no idea how this works anymore but it does
// Regex is so useful but it's so confusing
// This is all to parse out the emote text
const createRegex = (strings, emojis) => {
  const regexStrings = strings
    .sort()
    .reverse()
    .map(string => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  let regex = ''
  let flags = 'g'
  if (strings.length > 0) {
    regex += `(?<=\\s|^)(?:${regexStrings.join('|')})(?=\\s|$|[.,!])`
  }
  if (emojis.length > 0) {
    if (regex !== '')
      regex += '|'
    regex += `(?:${emojis.join('|')})`
    flags += 'u'
  }
  return new RegExp(regex, flags)
}

function generateColor(name) {
  if (!name) return DEFAULT_COLORS[0]
  const value = name
    .split('')
    .reduce((sum, letter) => sum + letter.charCodeAt(0), 0)
  return DEFAULT_COLORS[value % DEFAULT_COLORS.length]
}

function random(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function calcPosition(width, height) {
  const main = $('main')
  const widgetWidth = main.innerWidth()
  const widgetHeight = main.innerHeight()
  const { padding } = FieldData

  // edge testing
  /*-*
  return [
    random(0, 1) ? padding : Math.max(padding, widgetWidth - padding - width),
    random(0, 1) ? padding : Math.max(padding, widgetHeight - padding - height),
  ]
  /*-*/
  const minX = padding
  const maxX = Math.max(padding, widgetWidth - padding - width)
  const minY = padding
  const maxY = Math.max(padding, widgetHeight - padding - height)

  const randomX = random(minX, maxX)
  const randomY = random(minY, maxY)

  if (FieldData.positionMode === 'random') {
    return { top: randomY, left: randomX }
  } else {
    const possibleCoords = []
    const deviation = random(0, FieldData.edgeDeviation)

    if (FieldData.topEdge) {
      possibleCoords.push({ top: minY + deviation, left: randomX })
    }

    if (FieldData.bottomEdge) {
      possibleCoords.push({ bottom: minY + deviation, left: randomX })
    }

    if (FieldData.leftEdge) {
      possibleCoords.push({ left: minX + deviation, top: randomY })
    }

    if (FieldData.rightEdge) {
      possibleCoords.push({ right: minX + deviation, top: randomY })
    }

    // no edges chosen so just put all chats in the middle as an easter egg
    if (possibleCoords.length === 0) {
      return { left: (minX + maxX) / 2, top: (minY + maxY) / 2 }
    }

    return possibleCoords[random(0, possibleCoords.length - 1)]
  }
}

function joinIfArray(possibleArray, delimiter = '') {
  if (Array.isArray(possibleArray)) return possibleArray.join(delimiter)
  return possibleArray
}

const TEST_MESSAGES = [
  ['HYPE'],
  ['uwu'],
  [
    'popCat',
    [
      {
        type: 'bttv',
        name: 'popCat',
        id: '60d5abc38ed8b373e421952f',
        gif: true,
        urls: {
          1: 'https://cdn.betterttv.net/emote/60d5abc38ed8b373e421952f/1x',
          2: 'https://cdn.betterttv.net/emote/60d5abc38ed8b373e421952f/2x',
          4: 'https://cdn.betterttv.net/emote/60d5abc38ed8b373e421952f/3x',
        },
        start: 0,
        end: 6,
      },
    ],
  ],
  [
    'catHYPE hypeE catHYPE',
    [
      {
        type: 'bttv',
        name: 'catHYPE',
        id: '6090e9cc39b5010444d0b3ff',
        gif: true,
        urls: {
          1: 'https://cdn.betterttv.net/emote/6090e9cc39b5010444d0b3ff/1x',
          2: 'https://cdn.betterttv.net/emote/6090e9cc39b5010444d0b3ff/2x',
          4: 'https://cdn.betterttv.net/emote/6090e9cc39b5010444d0b3ff/3x',
        },
        start: 0,
        end: 7,
      },
      {
        type: 'bttv',
        name: 'hypeE',
        id: '5b6ded5560d17f4657e1319e',
        gif: true,
        urls: {
          1: 'https://cdn.betterttv.net/emote/5b6ded5560d17f4657e1319e/1x',
          2: 'https://cdn.betterttv.net/emote/5b6ded5560d17f4657e1319e/2x',
          4: 'https://cdn.betterttv.net/emote/5b6ded5560d17f4657e1319e/3x',
        },
        start: 8,
        end: 13,
      },
      {
        type: 'bttv',
        name: 'catHYPE',
        id: '6090e9cc39b5010444d0b3ff',
        gif: true,
        urls: {
          1: 'https://cdn.betterttv.net/emote/6090e9cc39b5010444d0b3ff/1x',
          2: 'https://cdn.betterttv.net/emote/6090e9cc39b5010444d0b3ff/2x',
          4: 'https://cdn.betterttv.net/emote/6090e9cc39b5010444d0b3ff/3x',
        },
        start: 14,
        end: 21,
      },
    ],
  ],
  [
    'zaytriLOVE',
    [
      {
        type: 'twitch',
        name: 'zaytriLOVE',
        id: '307974105',
        gif: false,
        urls: {
          1: 'https://static-cdn.jtvnw.net/emoticons/v2/307974105/default/dark/1.0',
          2: 'https://static-cdn.jtvnw.net/emoticons/v2/307974105/default/dark/2.0',
          4: 'https://static-cdn.jtvnw.net/emoticons/v2/307974105/default/dark/3.0',
        },
        start: 0,
        end: 9,
      },
    ],
  ],
  [
    'D: D: D:',
    [
      {
        type: 'bttv',
        name: 'D:',
        id: '55028cd2135896936880fdd7',
        gif: false,
        urls: {
          1: 'https://cdn.betterttv.net/emote/55028cd2135896936880fdd7/1x',
          2: 'https://cdn.betterttv.net/emote/55028cd2135896936880fdd7/2x',
          4: 'https://cdn.betterttv.net/emote/55028cd2135896936880fdd7/3x',
        },
        start: 0,
        end: 2,
      },
      {
        type: 'bttv',
        name: 'D:',
        id: '55028cd2135896936880fdd7',
        gif: false,
        urls: {
          1: 'https://cdn.betterttv.net/emote/55028cd2135896936880fdd7/1x',
          2: 'https://cdn.betterttv.net/emote/55028cd2135896936880fdd7/2x',
          4: 'https://cdn.betterttv.net/emote/55028cd2135896936880fdd7/3x',
        },
        start: 3,
        end: 5,
      },
      {
        type: 'bttv',
        name: 'D:',
        id: '55028cd2135896936880fdd7',
        gif: false,
        urls: {
          1: 'https://cdn.betterttv.net/emote/55028cd2135896936880fdd7/1x',
          2: 'https://cdn.betterttv.net/emote/55028cd2135896936880fdd7/2x',
          4: 'https://cdn.betterttv.net/emote/55028cd2135896936880fdd7/3x',
        },
        start: 6,
        end: 8,
      },
    ],
  ],
  [
    'toad sings but make it nightcore zaytriSCREME',
    [
      {
        type: 'twitch',
        name: 'zaytriSCREME',
        id: '305161229',
        gif: false,
        urls: {
          1: 'https://static-cdn.jtvnw.net/emoticons/v2/305161229/default/dark/1.0',
          2: 'https://static-cdn.jtvnw.net/emoticons/v2/305161229/default/dark/2.0',
          4: 'https://static-cdn.jtvnw.net/emoticons/v2/305161229/default/dark/3.0',
        },
        start: 33,
        end: 44,
      },
    ],
  ],
  [
    'bobDance bobDance bobDance',
    [
      {
        type: 'bttv',
        name: 'bobDance',
        id: '5e2a1da9bca2995f13fc0261',
        gif: true,
        urls: {
          1: 'https://cdn.betterttv.net/emote/5e2a1da9bca2995f13fc0261/1x',
          2: 'https://cdn.betterttv.net/emote/5e2a1da9bca2995f13fc0261/2x',
          4: 'https://cdn.betterttv.net/emote/5e2a1da9bca2995f13fc0261/3x',
        },
        start: 0,
        end: 8,
      },
      {
        type: 'bttv',
        name: 'bobDance',
        id: '5e2a1da9bca2995f13fc0261',
        gif: true,
        urls: {
          1: 'https://cdn.betterttv.net/emote/5e2a1da9bca2995f13fc0261/1x',
          2: 'https://cdn.betterttv.net/emote/5e2a1da9bca2995f13fc0261/2x',
          4: 'https://cdn.betterttv.net/emote/5e2a1da9bca2995f13fc0261/3x',
        },
        start: 9,
        end: 17,
      },
      {
        type: 'bttv',
        name: 'bobDance',
        id: '5e2a1da9bca2995f13fc0261',
        gif: true,
        urls: {
          1: 'https://cdn.betterttv.net/emote/5e2a1da9bca2995f13fc0261/1x',
          2: 'https://cdn.betterttv.net/emote/5e2a1da9bca2995f13fc0261/2x',
          4: 'https://cdn.betterttv.net/emote/5e2a1da9bca2995f13fc0261/3x',
        },
        start: 18,
        end: 26,
      },
    ],
  ],
  [
    'bongoTap',
    [
      {
        type: 'bttv',
        name: 'bongoTap',
        id: '5ba6d5ba6ee0c23989d52b10',
        gif: true,
        urls: {
          1: 'https://cdn.betterttv.net/emote/5ba6d5ba6ee0c23989d52b10/1x',
          2: 'https://cdn.betterttv.net/emote/5ba6d5ba6ee0c23989d52b10/2x',
          4: 'https://cdn.betterttv.net/emote/5ba6d5ba6ee0c23989d52b10/3x',
        },
        start: 0,
        end: 8,
      },
    ],
  ],
  [
    'Head gachiBASS Bang',
    [
      {
        type: '7tv',
        name: 'gachiBASS',
        id: '63047304b9163843cddda6e0',
        gif: true,
        urls: {
          1: 'https://cdn.7tv.app/emote/63047304b9163843cddda6e0/1x.webp',
          2: 'https://cdn.7tv.app/emote/63047304b9163843cddda6e0/2x.webp',
          4: 'https://cdn.7tv.app/emote/63047304b9163843cddda6e0/4x.webp',
        },
        start: 5,
        end: 14,
      },
    ],
  ],
  [
    'VoHiYo hello!',
    [
      {
        type: 'twitch',
        name: 'VoHiYo',
        id: '81274',
        gif: false,
        urls: {
          1: 'https://static-cdn.jtvnw.net/emoticons/v2/81274/default/dark/1.0',
          2: 'https://static-cdn.jtvnw.net/emoticons/v2/81274/default/dark/2.0',
          4: 'https://static-cdn.jtvnw.net/emoticons/v2/81274/default/dark/3.0',
        },
        start: 0,
        end: 5,
      },
    ],
  ],
  [
    'TwitchUnity',
    [
      {
        type: 'twitch',
        name: 'TwitchUnity',
        id: '196892',
        gif: false,
        urls: {
          1: 'https://static-cdn.jtvnw.net/emoticons/v2/196892/default/dark/1.0',
          2: 'https://static-cdn.jtvnw.net/emoticons/v2/196892/default/dark/2.0',
          4: 'https://static-cdn.jtvnw.net/emoticons/v2/196892/default/dark/3.0',
        },
        start: 0,
        end: 10,
      },
    ],
  ],
  [
    'MercyWing1 PinkMercy MercyWing2',
    [
      {
        type: 'twitch',
        name: 'MercyWing1',
        id: '1003187',
        gif: false,
        urls: {
          1: 'https://static-cdn.jtvnw.net/emoticons/v1/1003187/1.0',
          2: 'https://static-cdn.jtvnw.net/emoticons/v1/1003187/1.0',
          4: 'https://static-cdn.jtvnw.net/emoticons/v1/1003187/3.0',
        },
        start: 0,
        end: 9,
      },
      {
        type: 'twitch',
        name: 'PinkMercy',
        id: '1003190',
        gif: false,
        urls: {
          1: 'https://static-cdn.jtvnw.net/emoticons/v1/1003190/1.0',
          2: 'https://static-cdn.jtvnw.net/emoticons/v1/1003190/1.0',
          4: 'https://static-cdn.jtvnw.net/emoticons/v1/1003190/3.0',
        },
        start: 11,
        end: 19,
      },
      {
        type: 'twitch',
        name: 'MercyWing2',
        id: '1003189',
        gif: false,
        urls: {
          1: 'https://static-cdn.jtvnw.net/emoticons/v1/1003189/1.0',
          2: 'https://static-cdn.jtvnw.net/emoticons/v1/1003189/1.0',
          4: 'https://static-cdn.jtvnw.net/emoticons/v1/1003189/3.0',
        },
        start: 21,
        end: 30,
      },
    ],
  ],
  [
    'TransgenderPride PansexualPride NonbinaryPride LesbianPride IntersexPride GenderFluidPride GayPride BisexualPride AsexualPride',
    [
      {
        type: 'twitch',
        name: 'TransgenderPride',
        id: '307827377',
        gif: false,
        urls: {
          1: 'https://static-cdn.jtvnw.net/emoticons/v2/307827377/default/dark/1.0',
          2: 'https://static-cdn.jtvnw.net/emoticons/v2/307827377/default/dark/2.0',
          4: 'https://static-cdn.jtvnw.net/emoticons/v2/307827377/default/dark/3.0',
        },
        start: 0,
        end: 15,
      },
      {
        type: 'twitch',
        name: 'PansexualPride',
        id: '307827370',
        gif: false,
        urls: {
          1: 'https://static-cdn.jtvnw.net/emoticons/v2/307827370/default/dark/1.0',
          2: 'https://static-cdn.jtvnw.net/emoticons/v2/307827370/default/dark/2.0',
          4: 'https://static-cdn.jtvnw.net/emoticons/v2/307827370/default/dark/3.0',
        },
        start: 17,
        end: 30,
      },
      {
        type: 'twitch',
        name: 'NonbinaryPride',
        id: '307827356',
        gif: false,
        urls: {
          1: 'https://static-cdn.jtvnw.net/emoticons/v2/307827356/default/dark/1.0',
          2: 'https://static-cdn.jtvnw.net/emoticons/v2/307827356/default/dark/2.0',
          4: 'https://static-cdn.jtvnw.net/emoticons/v2/307827356/default/dark/3.0',
        },
        start: 32,
        end: 45,
      },
      {
        type: 'twitch',
        name: 'LesbianPride',
        id: '307827340',
        gif: false,
        urls: {
          1: 'https://static-cdn.jtvnw.net/emoticons/v2/307827340/default/dark/1.0',
          2: 'https://static-cdn.jtvnw.net/emoticons/v2/307827340/default/dark/2.0',
          4: 'https://static-cdn.jtvnw.net/emoticons/v2/307827340/default/dark/3.0',
        },
        start: 47,
        end: 58,
      },
      {
        type: 'twitch',
        name: 'IntersexPride',
        id: '307827332',
        gif: false,
        urls: {
          1: 'https://static-cdn.jtvnw.net/emoticons/v2/307827332/default/dark/1.0',
          2: 'https://static-cdn.jtvnw.net/emoticons/v2/307827332/default/dark/2.0',
          4: 'https://static-cdn.jtvnw.net/emoticons/v2/307827332/default/dark/3.0',
        },
        start: 60,
        end: 72,
      },
      {
        type: 'twitch',
        name: 'GenderFluidPride',
        id: '307827326',
        gif: false,
        urls: {
          1: 'https://static-cdn.jtvnw.net/emoticons/v2/307827326/default/dark/1.0',
          2: 'https://static-cdn.jtvnw.net/emoticons/v2/307827326/default/dark/2.0',
          4: 'https://static-cdn.jtvnw.net/emoticons/v2/307827326/default/dark/3.0',
        },
        start: 74,
        end: 89,
      },
      {
        type: 'twitch',
        name: 'GayPride',
        id: '307827321',
        gif: false,
        urls: {
          1: 'https://static-cdn.jtvnw.net/emoticons/v2/307827321/default/dark/1.0',
          2: 'https://static-cdn.jtvnw.net/emoticons/v2/307827321/default/dark/2.0',
          4: 'https://static-cdn.jtvnw.net/emoticons/v2/307827321/default/dark/3.0',
        },
        start: 91,
        end: 98,
      },
      {
        type: 'twitch',
        name: 'BisexualPride',
        id: '307827313',
        gif: false,
        urls: {
          1: 'https://static-cdn.jtvnw.net/emoticons/v2/307827313/default/dark/1.0',
          2: 'https://static-cdn.jtvnw.net/emoticons/v2/307827313/default/dark/2.0',
          4: 'https://static-cdn.jtvnw.net/emoticons/v2/307827313/default/dark/3.0',
        },
        start: 100,
        end: 112,
      },
      {
        type: 'twitch',
        name: 'AsexualPride',
        id: '307827267',
        gif: false,
        urls: {
          1: 'https://static-cdn.jtvnw.net/emoticons/v2/307827267/default/dark/1.0',
          2: 'https://static-cdn.jtvnw.net/emoticons/v2/307827267/default/dark/2.0',
          4: 'https://static-cdn.jtvnw.net/emoticons/v2/307827267/default/dark/3.0',
        },
        start: 114,
        end: 125,
      },
    ],
  ],
]

function htmlEncode(text) {
  return text.replace(/[\<\>\"\'\^\=]/g, char => `&#${char.charCodeAt(0)};`)
}
