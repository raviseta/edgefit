// Adopts the UIScene life cycle, which apps built with the iOS 27 SDK must use or they fail
// at launch. The Expo SDK 57 template still starts React Native from the app delegate; the
// `expo` package already ships `ExpoAppSceneDelegate`, so this applies the SDK 58 template's
// AppDelegate and Info.plist changes at prebuild.
// ponytail: delete this plugin when upgrading to Expo SDK 58, whose template does this itself.
const { withAppDelegate, withInfoPlist } = require('expo/config-plugins');

function replaceOnce(contents, find, replace) {
  if (!contents.includes(find)) {
    throw new Error(`withSceneLifecycle: AppDelegate.swift no longer contains:\n${find}`);
  }
  return contents.replace(find, replace);
}

function adoptScenes(contents) {
  if (contents.includes('ExpoAppSceneDelegate')) return contents;
  if (!contents.startsWith('internal import Expo')) {
    throw new Error('withSceneLifecycle: expected a Swift AppDelegate that imports Expo.');
  }

  let result = replaceOnce(
    contents,
    'class AppDelegate: ExpoAppDelegate {',
    'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {',
  );
  result = replaceOnce(
    result,
    `#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif
`,
    `    // SceneDelegate creates the window and starts React Native under the scene life cycle.
`,
  );
  // Under scenes UIKit no longer calls these; ExpoAppSceneDelegate forwards URLs and user
  // activities to the app delegate and RCTLinkingManager itself.
  const linkingStart = result.indexOf('  // Linking API');
  const delegateEnd = result.indexOf('\n}\n\nclass ReactNativeDelegate');
  if (linkingStart === -1 || delegateEnd === -1 || linkingStart > delegateEnd) {
    throw new Error('withSceneLifecycle: could not find the Linking overrides in AppDelegate.swift.');
  }
  result = result.slice(0, linkingStart).trimEnd() + result.slice(delegateEnd);

  return `${result.trimEnd()}

@objc(SceneDelegate)
class SceneDelegate: ExpoAppSceneDelegate {}
`;
}

module.exports = function withSceneLifecycle(config) {
  config = withAppDelegate(config, (mod) => {
    if (mod.modResults.language !== 'swift') {
      throw new Error('withSceneLifecycle: only a Swift AppDelegate is supported.');
    }
    mod.modResults.contents = adoptScenes(mod.modResults.contents);
    return mod;
  });

  return withInfoPlist(config, (mod) => {
    mod.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate',
          },
        ],
      },
    };
    return mod;
  });
};
