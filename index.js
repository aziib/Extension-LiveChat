import {
    saveSettingsDebounced,
    setUserName,
    setUserAvatar,
    getUserAvatars,
    getThumbnailUrl,
    substituteParams,
    user_avatar
} from "../../../../script.js";
import { debounce, createThumbnail } from "../../../utils.js";
import { promptQuietForLoudResponse, sendMessageAs, sendNarratorMessage } from "../../../slash-commands.js";
import { extension_settings, getContext, renderExtensionTemplate } from "../../../extensions.js";
import { registerSlashCommand } from "../../../slash-commands.js";

const extensionName = "third-party/Extension-LiveChat";

let idlepromptsaved; // Initialize idlepromptsaved as an empty array
let idlepromptsavedname; // Initialize idlepromptsaved as an empty array
let cachedidlepromptsaved;
let cachedidlepromptsavedname;

/**
 * Fetch idle prompts from the server and save them to idlepromptsaved.
 */
async function fetchIdlePrompts() {
    try {
        const response = await fetch('http://127.0.0.1:5006/chat');
    
        if (!response.ok) {
          throw new Error('Request failed');
        }
    
        const data = await response.json();
        const lastIndex = data.length - 1;
        idlepromptsavedname = data[lastIndex].author;
        idlepromptsaved = data[lastIndex].message; // Use data.length to get the length of the array directly

        return {
          author: data[lastIndex].author,
          message: data[lastIndex].message,
          avatarPP: data[lastIndex].avatarPP,
        };
      } catch (error) {
        console.error('Error:', error);
        // You can handle the error as needed.
        // For example, you can throw the error or return a default value.
      }
    };

    function setupIdlePromptFetching() {
        // Define a function to fetch and process idle prompts
        const fetchAndProcessIdlePrompts = async () => {
            try {
                const { author, message } = await fetchIdlePrompts();
                console.log("Fetched idle prompt:", author, message);
                // You can process the fetched prompt here
            } catch (error) {
                console.error('Error fetching idle prompts:', error);
            }
        };
    
        // Call fetchAndProcessIdlePrompts initially
        fetchAndProcessIdlePrompts();
    
        // Set up interval to fetch idle prompts every 3 seconds
        setInterval(fetchAndProcessIdlePrompts, 3000);
    }
jQuery(async () => {
    await loadSettingsHTML();
    loadSettings();
    setupListeners();
    setupIdlePromptFetching(); // Call the function to start fetching idle prompts
    if (extension_settings.idle.enabled) {
        resetIdleTimer();
    }
    // once the doc is ready, check if random time is checked and hide/show timer min
    if ($('#idle_random_time').prop('checked')) {
        $('#idle_timer_min').parent().show();
    }
    registerSlashCommand('idle', toggleIdle, [], '– toggles idle mode', true, true);
});


let idleTimer = 5;
let repeatCount = 0;

let defaultSettings = {
    enabled: true,
    timer: 3,
    prompts: idlepromptsaved,
    useContinuation: false,
    repeats: 9999999999999999, // 0 = infinite
    sendAs: "user",
    randomTime: false,
    timeMin: 3,
    includePrompt: true,
};


//TODO: Can we make this a generic function?
/**
 * Load the extension settings and set defaults if they don't exist.
 */
async function loadSettings() {
    if (!extension_settings.idle) {
        console.log("Creating extension_settings.idle");
        extension_settings.idle = {};
    }
    for (const [key, value] of Object.entries(defaultSettings)) {
        if (!extension_settings.idle.hasOwnProperty(key)) {
            console.log(`Setting default for: ${key}`);
            extension_settings.idle[key] = value;
        }
    }
    populateUIWithSettings();
}

//TODO: Can we make this a generic function too?
/**
 * Populate the UI components with values from the extension settings.
 */
function populateUIWithSettings() {
    $("#idle_timer").val(extension_settings.idle.timer).trigger("input");
    $("#idle_prompts").val(extension_settings.idle.prompts.join("\n")).trigger("input");
    $("#idle_use_continuation").prop("checked", extension_settings.idle.useContinuation).trigger("input");
    $("#idle_enabled").prop("checked", extension_settings.idle.enabled).trigger("input");
    $("#idle_repeats").val(extension_settings.idle.repeats).trigger("input");
    $("#idle_sendAs").val(extension_settings.idle.sendAs).trigger("input");
    $("#idle_random_time").prop("checked", extension_settings.idle.randomTime).trigger("input");
    $("#idle_timer_min").val(extension_settings.idle.timerMin).trigger("input");
    $("#idle_include_prompt").prop("checked", extension_settings.idle.includePrompt).trigger("input");
}


/**
 * Reset the idle timer based on the extension settings and context.
 */
function resetIdleTimer() {
    console.debug("Resetting idle timer");
    if (idleTimer) clearTimeout(idleTimer);
    //let context = getContext();
    //if (!context.characterId && !context.groupID) return;
    //if  (context.characterId && context.groupID) return;
    if (!extension_settings.idle.enabled) return;
    if (extension_settings.idle.randomTime) {
        // ensure these are ints
        let min = extension_settings.idle.timerMin;
        let max = extension_settings.idle.timer;
        min = parseInt(min);
        max = parseInt(max);
        let randomTime = (Math.random() * (max - min + 1)) + min;
        idleTimer = setTimeout(sendIdlePrompt, 1000 * randomTime);
    } else {
        idleTimer = setTimeout(sendIdlePrompt, 1000 * extension_settings.idle.timer);
    }
}

/**
 * Send a random idle prompt to the AI based on the extension settings.
 * Checks conditions like if the extension is enabled and repeat conditions.
 */
async function sendIdlePrompt() {
    if (!extension_settings.idle.enabled) return;

    // Check repeat conditions and waiting for a response
    if (repeatCount >= extension_settings.idle.repeats || $('#mes_stop').is(':visible')) {
        //console.debug("Not sending idle prompt due to repeat conditions or waiting for a response.");
        resetIdleTimer();
        return;
    }

    const randomPrompt = extension_settings.idle.prompts[
        Math.floor(Math.random() * extension_settings.idle.prompts.length)
    ];

    sendPrompt(randomPrompt);
    repeatCount++;
    resetIdleTimer();
}

// Assuming you have a function to capture user input
/**
 * Add our prompt to the chat and then send the chat to the backend.
 * @param {string} sendAs - The type of message to send. "user", "char", or "sys".
 * @param {string} prompt - The prompt text to send to the AI.
 */
function sendLoud(sendAs, prompt) {
    if (sendAs === "user" && idlepromptsaved !== cachedidlepromptsaved && cachedidlepromptsavedname !== idlepromptsavedname || sendAs === "user" && idlepromptsaved === cachedidlepromptsaved && cachedidlepromptsavedname !== idlepromptsavedname || sendAs === "user" && idlepromptsaved !== cachedidlepromptsaved && cachedidlepromptsavedname === idlepromptsavedname){
        setUserName(idlepromptsavedname);
        prompt = idlepromptsaved;
        cachedidlepromptsaved=idlepromptsaved;
        cachedidlepromptsavedname=idlepromptsavedname; 
        resetIdleTimer();
        $("#send_textarea").val(prompt);

        // Set the focus back to the textarea
        $("#send_textarea").focus();

        $("#send_but").trigger('click');
        return;
    } else if (sendAs === "char") {
        sendMessageAs("", `${getContext().name2}\n${prompt}`);
        promptQuietForLoudResponse(sendAs, "BRO");
    } else if (sendAs === "sys") {
        prompt = idlepromptsaved;
        sendNarratorMessage("", prompt);
        
        promptQuietForLoudResponse(sendAs, "");
    }
    else if (idlepromptsaved == cachedidlepromptsaved) {
        resetIdleTimer();       
        console.error(`Unknown sendAs value: ${sendAs}`);
    }
}

/**
 * Send the provided prompt to the AI. Determines method based on continuation setting.
 * @param {string} prompt - The prompt text to send to the AI.
 */
function sendPrompt(prompt) {
    clearTimeout(idleTimer);
    $("#send_textarea").off("input");

    if (extension_settings.idle.useContinuation) {
        $('#option_continue').trigger('click');
        console.debug("Sending idle prompt with continuation");
    } else {
        console.debug("Sending idle prompt");
        console.log(extension_settings.idle);
        if (extension_settings.idle.includePrompt  && cachedidlepromptsaved !== idlepromptsaved && cachedidlepromptsavedname !== idlepromptsavedname || extension_settings.idle.includePrompt  && cachedidlepromptsaved === idlepromptsaved && cachedidlepromptsavedname !== idlepromptsavedname || extension_settings.idle.includePrompt  && cachedidlepromptsaved !== idlepromptsaved && cachedidlepromptsavedname === idlepromptsavedname) {
            sendLoud(extension_settings.idle.sendAs, prompt);
        }
        else if (extension_settings.idle.includePrompt  && cachedidlepromptsaved !== idlepromptsaved) {
            promptQuietForLoudResponse(extension_settings.idle.sendAs, prompt);
        }
    }
}

/**
 * Load the settings HTML and append to the designated area.
 */
async function loadSettingsHTML() {
    const settingsHtml = renderExtensionTemplate(extensionName, "dropdown");
    $("#extensions_settings2").append(settingsHtml);
}

/**
 * Update a specific setting based on user input.
 * @param {string} elementId - The HTML element ID tied to the setting.
 * @param {string} property - The property name in the settings object.
 * @param {boolean} [isCheckbox=false] - Whether the setting is a checkbox.
 */
function updateSetting(elementId, property, isCheckbox = false) {
    let value = $(`#${elementId}`).val();
    if (isCheckbox) {
        value = $(`#${elementId}`).prop('checked');
    }

    if (property === "prompts") {
        value = value.split("\n");
    }

    extension_settings.idle[property] = value;
    saveSettingsDebounced();
}

/**
 * Attach an input listener to a UI component to update the corresponding setting.
 * @param {string} elementId - The HTML element ID tied to the setting.
 * @param {string} property - The property name in the settings object.
 * @param {boolean} [isCheckbox=false] - Whether the setting is a checkbox.
 */
function attachUpdateListener(elementId, property, isCheckbox = false) {
    $(`#${elementId}`).on('input', debounce(() => {
        updateSetting(elementId, property, isCheckbox);
    }, 250));
}

/**
 * Handle the enabling or disabling of the idle extension.
 * Adds or removes the idle listeners based on the checkbox's state.
 */
function handleIdleEnabled() {
    if (!extension_settings.idle.enabled) {
        clearTimeout(idleTimer);
        removeIdleListeners();
    } else {
        resetIdleTimer();
        attachIdleListeners();
    }
}


/**
 * Setup input listeners for the various settings and actions related to the idle extension.
 */
function setupListeners() {
    const settingsToWatch = [
        ['idle_timer', 'timer'],
        ['idle_prompts', 'prompts'],
        ['idle_use_continuation', 'useContinuation', true],
        ['idle_enabled', 'enabled', true],
        ['idle_repeats', 'repeats'],
        ['idle_sendAs', 'sendAs'],
        ['idle_random_time', 'randomTime', true],
        ['idle_timer_min', 'timerMin'],
        ['idle_include_prompt', 'includePrompt', true]
    ];
    settingsToWatch.forEach(setting => {
        attachUpdateListener(...setting);
    });

    // Idleness listeners, could be made better
    $('#idle_enabled').on('input', debounce(handleIdleEnabled, 250));

    // Add the idle listeners initially if the idle feature is enabled
    if (extension_settings.idle.enabled) {
        attachIdleListeners();
    }

    //show/hide timer min parent div
    $('#idle_random_time').on('input', function () {
        if ($(this).prop('checked')) {
            $('#idle_timer_min').parent().show();
        } else {
            $('#idle_timer_min').parent().hide();
        }

        $('#idle_timer').trigger('input');
    });

    // if we're including the prompt, hide raw from the sendAs dropdown
    $('#idle_include_prompt').on('input', function () {
        if ($(this).prop('checked')) {
            $('#idle_sendAs option[value="raw"]').hide();
        } else {
            $('#idle_sendAs option[value="raw"]').show();
        }
    });

    //make sure timer min is less than timer
    $('#idle_timer').on('input', function () {
        if ($('#idle_random_time').prop('checked')) {
            if ($(this).val() < $('#idle_timer_min').val()) {
                $('#idle_timer_min').val($(this).val());
                $('#idle_timer_min').trigger('input');
            }
        }
    });

}

const debouncedActivityHandler = debounce((event) => {
    // Check if the event target (or any of its parents) has the id "option_continue"
    if ($(event.target).closest('#option_continue').length) {
        return; // Do not proceed if the click was on (or inside) an element with id "option_continue"
    }

    console.debug("Activity detected, resetting idle timer");
    resetIdleTimer();
    repeatCount = 0;
}, 250);

function attachIdleListeners() {
    $(document).on("click keypress", debouncedActivityHandler);
    document.addEventListener('keydown', debouncedActivityHandler);
}

/**
 * Remove idle-specific listeners.
 */
function removeIdleListeners() {
    $(document).off("click keypress", debouncedActivityHandler);
    document.removeEventListener('keydown', debouncedActivityHandler);
}

function toggleIdle() {
    extension_settings.idle.enabled = !extension_settings.idle.enabled;
    $('#idle_enabled').prop('checked', extension_settings.idle.enabled);
    $('#idle_enabled').trigger('input');
    toastr.info(`Idle mode ${extension_settings.idle.enabled ? "enabled" : "disabled"}.`);
    resetIdleTimer();
}



jQuery(async () => {
    await loadSettingsHTML();
    loadSettings();
    setupListeners();
    if (extension_settings.idle.enabled) {
        resetIdleTimer();
    }
    // once the doc is ready, check if random time is checked and hide/show timer min
    if ($('#idle_random_time').prop('checked')) {
        $('#idle_timer_min').parent().show();
    }
    registerSlashCommand('idle', toggleIdle, [], '– toggles idle mode', true, true);
});
