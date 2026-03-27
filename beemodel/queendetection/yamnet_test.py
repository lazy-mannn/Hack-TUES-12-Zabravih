"""Installation test for YAMNet."""

import numpy as np
import tensorflow as tf

import params
import yamnet


class YAMNetTest(tf.test.TestCase):
  _params = None
  _yamnet = None
  _yamnet_classes = None

  @classmethod
  def setUpClass(cls):
    super().setUpClass()
    cls._params = params.Params()
    cls._yamnet = yamnet.yamnet_frames_model(cls._params)
    cls._yamnet.load_weights('yamnet/yamnet.h5')
    cls._yamnet_classes = yamnet.class_names('yamnet/yamnet_class_map.csv')

  def clip_test(self, waveform, expected_class_name, top_n=10):
    """Run the model on the waveform, check that expected class is in top-n."""
    predictions, _, _ = YAMNetTest._yamnet(waveform)
    clip_predictions = np.mean(predictions, axis=0)
    top_n_indices = np.argsort(clip_predictions)[-top_n:]
    top_n_scores = clip_predictions[top_n_indices]
    top_n_class_names = YAMNetTest._yamnet_classes[top_n_indices]
    top_n_predictions = list(zip(top_n_class_names, top_n_scores))
    self.assertIn(expected_class_name, top_n_class_names,
                  'Did not find expected class {} in top {} predictions: {}'.format(
                      expected_class_name, top_n, top_n_predictions))

  def testZeros(self):
    self.clip_test(
        waveform=np.zeros((int(3 * YAMNetTest._params.sample_rate),)),
        expected_class_name='Silence')

  def testRandom(self):
    # Create a numpy random Generator with a fixed seed for repeatability
    rng = np.random.default_rng(51773)
    self.clip_test(
        waveform=rng.uniform(-1.0, +1.0,
                              (int(3 * YAMNetTest._params.sample_rate),)),
        expected_class_name='White noise')

  def testSine(self):
    self.clip_test(
        waveform=np.sin(2 * np.pi * 440 *
                        np.arange(0, 3, 1 / YAMNetTest._params.sample_rate)),
        expected_class_name='Sine wave')


if __name__ == '__main__':
  tf.test.main()