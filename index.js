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

let livechatpromptsaved; // Initialize livechatpromptsaved as an empty array
let livechatpromptsavedname; // Initialize livechatpromptsaved as an empty array
let cachedlivechatpromptsaved;
let cachedlivechatpromptsavedname;

/**
 * Fetch livechat prompts from the server and save them to livechatpromptsaved.
 */
async function fetchlivechatPrompts() {
    try {
        const response = await fetch('http://127.0.0.1:5006/chat');
    
        if (!response.ok) {
          throw new Error('Request failed');
        }
    
        const data = await response.json();
        const lastIndex = data.length - 1;
        livechatpromptsavedname = data[lastIndex].author;
        livechatpromptsaved = data[lastIndex].message; // Use data.length to get the length of the array directly

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

    function setuplivechatPromptFetching() {
        // Define a function to fetch and process livechat prompts
        const fetchAndProcesslivechatPrompts = async () => {
            try {
                const { author, message } = await fetchlivechatPrompts();
                console.log("Fetched livechat prompt:", author, message);
                // You can process the fetched prompt here
            } catch (error) {
                console.error('Error fetching livechat prompts:', error);
            }
        };
    
        // Call fetchAndProcesslivechatPrompts initially
        fetchAndProcesslivechatPrompts();
    
        // Set up interval to fetch livechat prompts every 3 seconds
        setInterval(fetchAndProcesslivechatPrompts, 3000);
    }
jQuery(async () => {
    await loadSettingsHTML();
    loadSettings();
    setupListeners();
    setuplivechatPromptFetching(); // Call the function to start fetching livechat prompts
    if (extension_settings.livechat.enabled) {
        resetlivechatTimer();
    }
    // once the doc is ready, check if random time is checked and hide/show timer min
    if ($('#livechat_random_time').prop('checked')) {
        $('#livechat_timer_min').parent().show();
    }
    registerSlashCommand('livechat', togglelivechat, [], '– toggles livechat mode', true, true);
});


let livechatTimer = 5;
let repeatCount = 0;

let defaultSettings = {
    enabled: true,
    timer: 3,
    prompts: livechatpromptsaved,
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
    if (!extension_settings.livechat) {
        console.log("Creating extension_settings.livechat");
        extension_settings.livechat = {};
    }
    for (const [key, value] of Object.entries(defaultSettings)) {
        if (!extension_settings.livechat.hasOwnProperty(key)) {
            console.log(`Setting default for: ${key}`);
            extension_settings.livechat[key] = value;
        }
    }
    populateUIWithSettings();
}

//TODO: Can we make this a generic function too?
/**
 * Populate the UI components with values from the extension settings.
 */
function populateUIWithSettings() {
    $("#livechat_timer").val(extension_settings.livechat.timer).trigger("input");
    $("#livechat_prompts").val(extension_settings.livechat.prompts.join("\n")).trigger("input");
    $("#livechat_use_continuation").prop("checked", extension_settings.livechat.useContinuation).trigger("input");
    $("#livechat_enabled").prop("checked", extension_settings.livechat.enabled).trigger("input");
    $("#livechat_repeats").val(extension_settings.livechat.repeats).trigger("input");
    $("#livechat_sendAs").val(extension_settings.livechat.sendAs).trigger("input");
    $("#livechat_random_time").prop("checked", extension_settings.livechat.randomTime).trigger("input");
    $("#livechat_timer_min").val(extension_settings.livechat.timerMin).trigger("input");
    $("#livechat_include_prompt").prop("checked", extension_settings.livechat.includePrompt).trigger("input");
}


/**
 * Reset the livechat timer based on the extension settings and context.
 */
function resetlivechatTimer() {
    console.debug("Resetting livechat timer");
    if (livechatTimer) clearTimeout(livechatTimer);
    //let context = getContext();
    //if (!context.characterId && !context.groupID) return;
    //if  (context.characterId && context.groupID) return;
    if (!extension_settings.livechat.enabled) return;
    if (extension_settings.livechat.randomTime) {
        // ensure these are ints
        let min = extension_settings.livechat.timerMin;
        let max = extension_settings.livechat.timer;
        min = parseInt(min);
        max = parseInt(max);
        let randomTime = (Math.random() * (max - min + 1)) + min;
        livechatTimer = setTimeout(sendlivechatPrompt, 1000 * randomTime);
    } else {
        livechatTimer = setTimeout(sendlivechatPrompt, 1000 * extension_settings.livechat.timer);
    }
}

/**
 * Send a random livechat prompt to the AI based on the extension settings.
 * Checks conditions like if the extension is enabled and repeat conditions.
 */
async function sendlivechatPrompt() {
    if (!extension_settings.livechat.enabled) return;

    // Check repeat conditions and waiting for a response
    if (repeatCount >= extension_settings.livechat.repeats || $('#mes_stop').is(':visible')) {
        //console.debug("Not sending livechat prompt due to repeat conditions or waiting for a response.");
        resetlivechatTimer();
        return;
    }

    const randomPrompt = extension_settings.livechat.prompts[
        Math.floor(Math.random() * extension_settings.livechat.prompts.length)
    ];

    sendPrompt(randomPrompt);
    repeatCount++;
    resetlivechatTimer();
}

// Assuming you have a function to capture user input
/**
 * Add our prompt to the chat and then send the chat to the backend.
 * @param {string} sendAs - The type of message to send. "user", "char", or "sys".
 * @param {string} prompt - The prompt text to send to the AI.
 */
function sendLoud(sendAs, prompt) {
    if (sendAs === "user" && livechatpromptsaved !== cachedlivechatpromptsaved && cachedlivechatpromptsavedname !== livechatpromptsavedname || sendAs === "user" && livechatpromptsaved === cachedlivechatpromptsaved && cachedlivechatpromptsavedname !== livechatpromptsavedname || sendAs === "user" && livechatpromptsaved !== cachedlivechatpromptsaved && cachedlivechatpromptsavedname === livechatpromptsavedname){
        setUserName(livechatpromptsavedname);
        prompt = livechatpromptsaved;
        cachedlivechatpromptsaved=livechatpromptsaved;
        cachedlivechatpromptsavedname=livechatpromptsavedname; 
        resetlivechatTimer();
        $("#send_textarea").val(prompt);

        // Set the focus back to the textarea
        $("#send_textarea").focus();

        $("#send_but").trigger('click');
        return;
    } else if (sendAs === "char") {
        sendMessageAs("", `${getContext().name2}\n${prompt}`);
        promptQuietForLoudResponse(sendAs, "BRO");
    } else if (sendAs === "sys") {
        prompt = livechatpromptsaved;
        sendNarratorMessage("", prompt);
        
        promptQuietForLoudResponse(sendAs, "");
    }
    else if (livechatpromptsaved == cachedlivechatpromptsaved) {
        resetlivechatTimer();       
        console.error(`Unknown sendAs value: ${sendAs}`);
    }
}

/**
 * Send the provided prompt to the AI. Determines method based on continuation setting.
 * @param {string} prompt - The prompt text to send to the AI.
 */
function sendPrompt(prompt) {
    clearTimeout(livechatTimer);
    $("#send_textarea").off("input");

    if (extension_settings.livechat.useContinuation) {
        $('#option_continue').trigger('click');
        console.debug("Sending livechat prompt with continuation");
    } else {
        console.debug("Sending livechat prompt");
        console.log(extension_settings.livechat);
        if (extension_settings.livechat.includePrompt  && cachedlivechatpromptsaved !== livechatpromptsaved && cachedlivechatpromptsavedname !== livechatpromptsavedname || extension_settings.livechat.includePrompt  && cachedlivechatpromptsaved === livechatpromptsaved && cachedlivechatpromptsavedname !== livechatpromptsavedname || extension_settings.livechat.includePrompt  && cachedlivechatpromptsaved !== livechatpromptsaved && cachedlivechatpromptsavedname === livechatpromptsavedname) {
            sendLoud(extension_settings.livechat.sendAs, prompt);
        }
        else if (extension_settings.livechat.includePrompt  && cachedlivechatpromptsaved !== livechatpromptsaved) {
            promptQuietForLoudResponse(extension_settings.livechat.sendAs, prompt);
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

    extension_settings.livechat[property] = value;
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
 * Handle the enabling or disabling of the livechat extension.
 * Adds or removes the livechat listeners based on the checkbox's state.
 */
function handlelivechatEnabled() {
    if (!extension_settings.livechat.enabled) {
        clearTimeout(livechatTimer);
        removelivechatListeners();
    } else {
        resetlivechatTimer();
        attachlivechatListeners();
    }
}


/**
 * Setup input listeners for the various settings and actions related to the livechat extension.
 */
function setupListeners() {
    const settingsToWatch = [
        ['livechat_timer', 'timer'],
        ['livechat_prompts', 'prompts'],
        ['livechat_use_continuation', 'useContinuation', true],
        ['livechat_enabled', 'enabled', true],
        ['livechat_repeats', 'repeats'],
        ['livechat_sendAs', 'sendAs'],
        ['livechat_random_time', 'randomTime', true],
        ['livechat_timer_min', 'timerMin'],
        ['livechat_include_prompt', 'includePrompt', true]
    ];
    settingsToWatch.forEach(setting => {
        attachUpdateListener(...setting);
    });

    // livechatness listeners, could be made better
    $('#livechat_enabled').on('input', debounce(handlelivechatEnabled, 250));

    // Add the livechat listeners initially if the livechat feature is enabled
    if (extension_settings.livechat.enabled) {
        attachlivechatListeners();
    }

    //show/hide timer min parent div
    $('#livechat_random_time').on('input', function () {
        if ($(this).prop('checked')) {
            $('#livechat_timer_min').parent().show();
        } else {
            $('#livechat_timer_min').parent().hide();
        }

        $('#livechat_timer').trigger('input');
    });

    // if we're including the prompt, hide raw from the sendAs dropdown
    $('#livechat_include_prompt').on('input', function () {
        if ($(this).prop('checked')) {
            $('#livechat_sendAs option[value="raw"]').hide();
        } else {
            $('#livechat_sendAs option[value="raw"]').show();
        }
    });

    //make sure timer min is less than timer
    $('#livechat_timer').on('input', function () {
        if ($('#livechat_random_time').prop('checked')) {
            if ($(this).val() < $('#livechat_timer_min').val()) {
                $('#livechat_timer_min').val($(this).val());
                $('#livechat_timer_min').trigger('input');
            }
        }
    });

}

const debouncedActivityHandler = debounce((event) => {
    // Check if the event target (or any of its parents) has the id "option_continue"
    if ($(event.target).closest('#option_continue').length) {
        return; // Do not proceed if the click was on (or inside) an element with id "option_continue"
    }

    console.debug("Activity detected, resetting livechat timer");
    resetlivechatTimer();
    repeatCount = 0;
}, 250);

function attachlivechatListeners() {
    $(document).on("click keypress", debouncedActivityHandler);
    document.addEventListener('keydown', debouncedActivityHandler);
}

/**
 * Remove livechat-specific listeners.
 */
function removelivechatListeners() {
    $(document).off("click keypress", debouncedActivityHandler);
    document.removeEventListener('keydown', debouncedActivityHandler);
}

function togglelivechat() {
    extension_settings.livechat.enabled = !extension_settings.livechat.enabled;
    $('#livechat_enabled').prop('checked', extension_settings.livechat.enabled);
    $('#livechat_enabled').trigger('input');
    toastr.info(`livechat mode ${extension_settings.livechat.enabled ? "enabled" : "disabled"}.`);
    resetlivechatTimer();
}



jQuery(async () => {
    await loadSettingsHTML();
    loadSettings();
    setupListeners();
    if (extension_settings.livechat.enabled) {
        resetlivechatTimer();
    }
    // once the doc is ready, check if random time is checked and hide/show timer min
    if ($('#livechat_random_time').prop('checked')) {
        $('#livechat_timer_min').parent().show();
    }
    registerSlashCommand('livechat', togglelivechat, [], '– toggles livechat mode', true, true);
});
