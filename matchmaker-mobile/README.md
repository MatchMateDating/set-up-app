To run the mobile app: 

## iOS:
####run `npm install` and then `npx expo start`

## Android:
### frontend:
#### run `npm install` and `npx expo start:android`
### backend:
#### run `flask run --host=0.0.0.0`

### Tips
#### Your expo packages might be outdated run this to update:
```
npm install @expo/vector-icons@^15.0.3
npm install @react-native-picker/picker@2.11.1
npm install expo@~54.0.27
npm install expo-clipboard@~8.0.8
npm install expo-status-bar@~3.0.9
npm install react-native@0.81.5
```

#### To uninstall the app run `adb uninstall com.allyaoyao.matchmakermobile`
#### To prebuild cleanly `npx expo prebuild --clean`


I also have a .env file under the parent folder, this will be used by the babel.config.js file to load the local variables.
This file currently just has:
API_BASE_URL=http://192.168.1.29:5000

