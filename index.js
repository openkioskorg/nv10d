import mqtt from 'mqtt'
import sspLib from 'encrypted-smiley-secure-protocol'
import fs from 'fs'
import YAML from 'yaml'
import minimist from 'minimist'

const argv = minimist(process.argv)
if (!argv.config) {
  throw new Error("Provide path to the configuration file with --config");
}
const file = fs.readFileSync(argv.config, 'utf8')
const config = YAML.parse(file)

let client = mqtt.connect(config.mqtt.broker, {protocolVersion: 5, clientId: config.mqtt.client_id});

client.on("connect", () => {
  client.subscribe(config.mqtt.topic, {nl: true}, (err) => {
    if (!err) {
      console.log("Successfully subscribed")
    }
  });
});

client.on("message", (topic, message) => {
  var msg = JSON.parse(message.toString());

  console.log("Received command:", msg.cmd)
  switch (msg.cmd) {
    case 'start':
      eSSP.command('ENABLE').then(result => {
        console.log(result)
      })
      break;
    case 'stop':
      eSSP.command('DISABLE').then(result => {
        console.log(result)
      })
      break;
    default:
      console.log("Unknown cmd:", msg.cmd)
  }
});


let eSSP = new sspLib({
  id: 0,
  debug: false,
  timeout: 3000,
});

eSSP.on('OPEN', () => {
  console.log('open');

  eSSP.command('SYNC')
  .then(() => eSSP.command('HOST_PROTOCOL_VERSION', { version: 6 }))
  .then(() => eSSP.command('GET_SERIAL_NUMBER'))
  .then(result => {
    console.log('SERIAL NUMBER:', result.info.serial_number)
    return;
  })
  .then(() => eSSP.enable())
  .then(result => {
    if(result.status == 'OK'){
      console.log('Device is active')
    }
  	return;
  })
})

eSSP.on('NOTE_REJECTED', result => {
  console.log('NOTE_REJECTED', result);

  eSSP.command('LAST_REJECT_CODE')
  .then(result => {
    console.log(result)
  })
})

eSSP.on('CREDIT_NOTE', result => {
  console.log('CREDIT_NOTE', result);
  var data = {
    event: "moneyin",
    data: {
      amount: 100,
      currency: "eur"
    },
  }
  client.publish(config.mqtt.topic, JSON.stringify(data), {nl: true});
})

eSSP.open(config.device_path);