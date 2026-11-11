import { Text, View } from '@tarojs/components';
import { Icon } from './Icon';

interface NoticeCardProps {
  notice: string;
  onEdit: () => void;
}

/** 底部球局提示卡，点击进入编辑。 */
export function NoticeCard({ notice, onEdit }: NoticeCardProps) {
  return (
    <View className="notice-card" onClick={onEdit}>
      <View className="notice-mark">
        <Icon name="alert" size={20} />
      </View>
      <View className="notice-body">
        <Text className="notice-label">球局提示</Text>
        <Text className="notice-text">{notice}</Text>
      </View>
      <Icon name="edit" size={22} color="#8b948c" />
    </View>
  );
}
